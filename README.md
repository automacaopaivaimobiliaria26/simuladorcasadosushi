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

A configuração de produção está em `Dockerfile` e `deploy/vps/nginx.conf`. O container é compilado para o caminho `https://www.paivanegociosimobiliarios.com.br/simuladorcasasushi/`; a regra Traefik deve combinar esse host com `Path('/simuladorcasasushi') || PathPrefix('/simuladorcasasushi/')`. Preserve o router existente da raiz do domínio: não associe este app ao host sem o filtro de caminho. Use o Dockerfile na raiz, build context `.` e porta interna do contêiner `80`; não publique portas diretamente no host.

Consulte [`deploy/vps/README.md`](deploy/vps/README.md) para o procedimento completo, verificação e reversão.

## Privacidade e persistência

Esta página é estática e não tem login. As fórmulas e premissas iniciais necessárias ao simulador são entregues ao navegador; portanto, podem ser inspecionadas por quem acessar o site. Se esses dados forem confidenciais, não publique o site sem restringir o acesso. A aplicação não inclui o arquivo Excel original nem o documento de arquitetura.

`localStorage` é isolado por origem (protocolo + host) e navegador. A mudança de `/` para `/simuladorcasasushi/` no mesmo host HTTPS preserva a origem e deve manter os cenários desse navegador. Antes de mudar de host, exporte a configuração em Excel e importe-a no endereço novo.
