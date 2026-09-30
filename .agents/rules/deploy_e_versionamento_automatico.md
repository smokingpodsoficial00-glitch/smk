# CONFIGURAÇÃO PERMANENTE: DEPLOY E VERSIONAMENTO AUTOMÁTICO

Esta regra define a política padrão de ciclo de vida, versionamento e deploy contínuo para o projeto Smoking Pods / SaaS.

## REGRA PRINCIPAL: FLUXO OBRIGATÓRIO PÓS-ALTERAÇÃO

Sempre que uma alteração for solicitada pelo usuário e a implementação for concluída com sucesso:

1. **Compilação e Build:**
   - Executar `npm run build` no `admin` (`tsc -b && vite build`).
   - Executar `npm run build` no `frontend` (`tsc -b && vite build`), se aplicável.
   - Garantir código de saída 0 (zero erros de tipagem ou bundling).

2. **Testes e Validação Local:**
   - Executar testes automatizados, scripts de validação ou testes de ponta a ponta pertinentes à alteração antes de qualquer publicação.
   - Proibido fazer deploy sem validação local bem-sucedida.

3. **Revisão de Git Diff e Status:**
   - Executar `git status` e `git diff`.
   - **NUNCA** incluir arquivos secretos ou sensíveis (`.env`, `.env.local`, tokens, chaves, credenciais, `.admin_pwd`, etc.).
   - Não apagar alterações preexistentes do usuário alheias à tarefa.

4. **Commit:**
   - Criar mensagem de commit clara, convencional e descritiva do que foi alterado.

5. **Push:**
   - Fazer push para a branch `main` no repositório Git oficial (`origin` e `amigo`, se aplicável).

6. **Deploy na Vercel:**
   - Confirmar a execução do deploy da Vercel após o push.
   - Aguardar a conclusão e validar o status (200 OK na URL de produção).
   - Se o deploy falhar, reportar exatamente o erro com transparência sem tentar correções cegas não autorizadas.

7. **Relatório Final Estruturado:**
   - O que foi alterado;
   - Resultado do build/testes;
   - Commit realizado (hash e mensagem);
   - Push realizado;
   - Resultado do deploy da Vercel;
   - URL/ambiente atualizado.

---

## RESTRIÇÃO CRÍTICA — BANCO DE DADOS (SUPABASE)

Esta autorização de deploy automático **NÃO se aplica ao banco de dados Supabase**.
É terminantemente proibido executar automaticamente:
- Migrations de banco;
- DROP / ALTER destrutivos;
- Criação ou alteração de tabelas;
- Alterações em RLS (Row Level Security);
- Triggers ou RPCs;
- Seeds ou modificação de dados no Supabase.

Qualquer alteração em banco de dados continua **exigindo instrução e autorização prévia específica do usuário**.

---

## SEGURANÇA E PRIVACIDADE

- **NUNCA** imprimir, expor em logs ou commitar: tokens, senhas, chaves de API, JWTs, `service_role keys` ou segredos de ambiente.
- Não alterar domínios, DNS, planos ou credenciais de produção sem autorização expressa.
