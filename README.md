# Simulador Financeiro — Yakiniku / Casa do Sushi

Aplicação web estática para simulação financeira, com premissas editáveis, projeção mensal, DRE, indicadores, simulação de receita e exportação/importação Excel. Os dados editados são salvos no `localStorage` do navegador; não há banco de dados nem sincronização entre dispositivos.

## Executar e validar localmente

Requisitos: Node.js 22 e pnpm 10.18.0 (via Corepack).

```bash
corepack enable
corepack prepare pnpm@10.18.0 --activate
pnpm install --frozen-lockfile
pnpm check
pnpm test -- --reporter=dot
pnpm build:static
```

A saída estática de produção fica em `dist/public/`.

## VPS — Docker / EasyPanel / Traefik

A configuração de produção está em `Dockerfile` e `deploy/vps/nginx.conf`. No EasyPanel, conecte este repositório e selecione a branch de produção; use o Dockerfile na raiz, build context `.` e porta interna do contêiner `80`. Registre o domínio na aplicação para que o Traefik faça o roteamento HTTPS. Não publique portas do contêiner diretamente no host.

Consulte [`deploy/vps/README.md`](deploy/vps/README.md) para o procedimento completo, verificação e reversão.

## Privacidade e persistência

Esta página é estática e não tem login. As fórmulas e premissas iniciais necessárias ao simulador são entregues ao navegador; portanto, podem ser inspecionadas por quem acessar o site. Se esses dados forem confidenciais, não publique o site sem restringir o acesso. A aplicação não inclui o arquivo Excel original nem o documento de arquitetura.

`localStorage` é isolado por domínio e navegador. Antes de mudar de domínio, exporte a configuração em Excel e importe-a no endereço novo se quiser preservar as premissas personalizadas.
