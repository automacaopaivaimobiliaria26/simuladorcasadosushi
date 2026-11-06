# Deploy na VPS via EasyPanel e Traefik

## O que o pacote pressupõe

A arquitetura analisada descreve Oracle Cloud Brazil East, Ubuntu 24.04 ARM64, Docker/Swarm, EasyPanel e Traefik. O site principal já atende `www.paivanegociosimobiliarios.com.br/`; este simulador deve ficar somente em `https://www.paivanegociosimobiliarios.com.br/simuladorcasasushi/`.

O app é estático, usa Nginx na porta **interna** 80 e é compilado com a base `/simuladorcasasushi/`. Não abre porta no host, não muda DNS e não altera firewall.

## Atualização do código já enviado

A atualização de prefixo é incremental sobre a branch existente `feat/vps-deploy`. Na pasta extraída do pacote, execute:

```bash
bash "$HOME/PROJETOS/simuladorcasadosushi-vps-package/commands/aplicar-prefixo.sh" \
  "$HOME/PROJETOS/simuladorcasadosushi"
```

O script exige a raiz de um clone limpo, `origin` correto e a branch `feat/vps-deploy`. Ele apenas aplica o patch local: **não** faz commit, push, merge nem deploy. Depois revise os arquivos e valide conforme as instruções em `docs/COMANDOS-GITHUB.md`; envie a atualização à mesma branch e aguarde o build no EasyPanel.

## Roteamento do domínio sem tomar a raiz

No EasyPanel, mantenha o site atual da raiz do domínio inalterado e configure o serviço do simulador com:

- Repositório: `automacaopaivaimobiliaria26/simuladorcasadosushi`.
- Branch: `feat/vps-deploy` para homologação; depois de mesclar o Pull Request, use `main`.
- Build: Dockerfile na raiz do repositório; build context `.`.
- Porta upstream do contêiner: HTTP `80`.
- Host HTTPS: `www.paivanegociosimobiliarios.com.br`.
- Caminho/expressão de rota: exatamente `/simuladorcasasushi` e subcaminhos. Regra Traefik equivalente: `Host("www.paivanegociosimobiliarios.com.br") && (Path("/simuladorcasasushi") || PathPrefix("/simuladorcasasushi/"))`.
- Não configure um roteador apenas por `Host(...)` para este simulador, pois isso pode substituir o serviço que atende a página inicial. Dê precedência à rota específica, mantenha a rota raiz atual e não aplique middleware StripPrefix: o Nginx deste pacote recebe o caminho e remove o prefixo internamente.
- Reutilize o certificado HTTPS válido do domínio gerenciado pelo EasyPanel/Traefik; não altere DNS, firewall nem portas públicas.

Se o formulário de domínio do EasyPanel só aceitar o host e não permitir caminho/PathPrefix, **não salve** o host neste serviço (isso pode desviar a raiz para o simulador). Peça ao administrador da VPS para adicionar um roteador Traefik específico ao caminho, preservando o router atual da raiz. A disponibilidade da configuração de caminho depende da versão/configuração instalada do EasyPanel.

## Verificação antes e depois da publicação

Após reconstruir a imagem, confirme os seguintes endereços sem afetar a home existente:

```bash
curl -I https://www.paivanegociosimobiliarios.com.br/
curl -I https://www.paivanegociosimobiliarios.com.br/simuladorcasasushi
curl -fsS https://www.paivanegociosimobiliarios.com.br/simuladorcasasushi/healthz
curl -fsS https://www.paivanegociosimobiliarios.com.br/simuladorcasasushi/manus-routes.json
curl -fsS https://www.paivanegociosimobiliarios.com.br/simuladorcasasushi/ | grep -Eo '/simuladorcasasushi/assets/[^" ]+'
```

Esperado: a home `/` continua servindo o site anterior; o endereço sem barra redireciona para `/simuladorcasasushi/`; healthcheck e manifesto retornam HTTP 200; o HTML referencia assets sob o mesmo prefixo. Abra a página em janela anônima e teste um recálculo, download/importação Excel e impressão PDF.

O `localStorage` é delimitado pela origem (host + protocolo), não pelo caminho. Como o host HTTPS será o mesmo, os cenários salvos nesse navegador tendem a continuar disponíveis; ainda assim, exporte uma configuração Excel antes de promover/reverter como cópia de segurança.

## Reversão

A reversão do código é selecionar no EasyPanel o commit/imagem anterior e redeployar somente o serviço do simulador. Para remover o caminho, desative apenas o router `PathPrefix("/simuladorcasasushi/")`, sem tocar no router nem no DNS do site principal.

## Privacidade

O simulador não implementa autenticação. As premissas e fórmulas no frontend são visíveis a quem acessa a URL. Restrinja o acesso no EasyPanel se esses dados não puderem ser públicos.
