import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

// Disposable real Postgres engine, not a mock SQL parser. No remote credentials.
test('capture schema enforces privacy, retry uniqueness and revision conflicts', async () => {
  const db = new PGlite();
  const cameron = '10000000-0000-0000-0000-000000000001';
  const corine = '10000000-0000-0000-0000-000000000002';
  const household = '20000000-0000-0000-0000-000000000001';
  const otherHousehold = '20000000-0000-0000-0000-000000000002';
  const capture = '30000000-0000-0000-0000-000000000001';
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role bypassrls;
      create schema auth;
      create table auth.users (id uuid primary key);
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth, public to anon, authenticated, service_role;
      grant execute on function auth.uid() to authenticated;
      create table public.households (id uuid primary key);
      create table public.household_memberships (household_id uuid, user_id uuid, role text);
      alter table public.household_memberships enable row level security;
      grant select on public.household_memberships to authenticated;
      create policy self_membership on public.household_memberships for select to authenticated
        using (user_id = (select auth.uid()));
      alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    `);
    await db.exec(await readFile(new URL('../supabase/migrations/20260909004732_household_capture_loop.sql', import.meta.url), 'utf8'));
    await db.query('insert into auth.users values ($1), ($2)', [cameron, corine]);
    await db.query('insert into public.households values ($1), ($2)', [household, otherHousehold]);
    await db.query("insert into public.household_memberships values ($1,$2,'owner'), ($1,$3,'owner')", [household, cameron, corine]);
    await db.exec('set role service_role');
    const insert = 'insert into public.household_captures (id,household_id,user_id,source,source_key,source_text) values ($1,$2,$3,$4,$5,$6)';
    await db.query(insert, [capture, household, cameron, 'paste', 'retry-key', 'Private daycare notice']);
    await db.query(insert, ['30000000-0000-0000-0000-000000000002', household, corine, 'paste', 'retry-key', 'Private other adult notice']);
    await db.query(insert, ['30000000-0000-0000-0000-000000000003', otherHousehold, cameron, 'paste', 'retry-key', 'Wrong household']);
    await assert.rejects(db.query(insert, ['30000000-0000-0000-0000-000000000004', household, cameron, 'paste', 'retry-key', 'Duplicate']), /unique/);
    const first = await db.query('update public.household_captures set revision = 1 where id = $1 and revision = 0 returning id', [capture]);
    const stale = await db.query('update public.household_captures set revision = 1 where id = $1 and revision = 0 returning id', [capture]);
    assert.equal(first.rows.length, 1); assert.equal(stale.rows.length, 0);
    await assert.rejects(db.query('delete from public.household_captures where id = $1', [capture]), /permission denied/);
    await db.exec('reset role; set role authenticated');
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [cameron]);
    const own = await db.query('select source_text from public.household_captures');
    assert.deepEqual(own.rows, [{ source_text: 'Private daycare notice' }]);
    await assert.rejects(db.query('update public.household_captures set revision = 100 where id = $1', [capture]), /permission denied/);
    await assert.rejects(db.query(insert, ['30000000-0000-0000-0000-000000000004', household, cameron, 'paste', 'new', 'Bypass']), /permission denied/);
    await assert.rejects(db.query('delete from public.household_captures'), /permission denied/);
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [corine]);
    assert.deepEqual((await db.query('select source_text from public.household_captures')).rows, [{ source_text: 'Private other adult notice' }]);
    await db.exec('reset role; set role anon');
    for (const sql of ['select * from public.household_captures', 'delete from public.household_captures', 'update public.household_captures set revision = 0']) {
      await assert.rejects(db.query(sql), /permission denied/);
    }
    await assert.rejects(db.query(insert, ['30000000-0000-0000-0000-000000000004', household, cameron, 'paste', 'new', 'Anonymous']), /permission denied/);
    await db.exec('reset role');
    await db.query("update public.household_memberships set role = 'member' where user_id = $1", [cameron]);
    await db.exec('set role authenticated');
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [cameron]);
    assert.equal((await db.query('select * from public.household_captures')).rows.length, 0);
  } finally { await db.close(); }
});
