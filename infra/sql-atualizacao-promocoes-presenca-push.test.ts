import fs from 'fs';
import path from 'path';

const sql = fs.readFileSync(
  path.join(process.cwd(), 'infra/sql-atualizacao-promocoes-presenca-push.sql'),
  'utf8'
);

describe('sql-atualizacao-promocoes-presenca-push', () => {
  it('creates flexible promotion and item tables', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS promocoes');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS promocao_itens');
    expect(sql).toContain("CHECK (tipo IN ('combo_misto','mesmo_item','horario'))");
    expect(sql).toContain("CHECK (desconto_tipo IN ('valor_fixo','percentual','preco_fechado'))");
  });

  it('creates beach presence and push structures', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS sessoes_quiosque');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS customer_push_tokens');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS promocao_push_queue');
    expect(sql).toContain('uniq_sessao_quiosque_active_customer');
  });

  it('provides RPCs for cart calculation, session touch, close and push targeting', () => {
    expect(sql).toContain('CREATE OR REPLACE FUNCTION calcular_promocoes_carrinho');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION touch_sessao_quiosque');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION fechar_sessoes_quiosque');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION listar_push_promocao_ativa');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION enfileirar_push_promocao');
    expect(sql).toContain('AND (hora_inicio IS NULL OR NOW()::TIME >= hora_inicio)');
    expect(sql).toContain('AND (hora_fim IS NULL OR NOW()::TIME <= hora_fim)');
  });

  it('keeps Supabase service role grants explicit', () => {
    expect(sql).toContain('GRANT SELECT, INSERT, UPDATE, DELETE ON promocoes TO service_role');
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION calcular_promocoes_carrinho(UUID, JSONB, TIMESTAMPTZ) TO service_role');
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION listar_push_promocao_ativa(UUID) TO service_role');
  });
});
