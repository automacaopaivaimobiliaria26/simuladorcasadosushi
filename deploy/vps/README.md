# Deploy na VPS via EasyPanel e Traefik

## O que o pacote pressupõe

Com base no documento `Arquitetura_Infraestrutura_Automacoes_Paiva(3).docx` (referência de 19/08/2026), a infraestrutura é Oracle Cloud Brazil East, Ubuntu 24.04 ARM64, Docker/Docker Swarm, EasyPanel e Traefik 3.6.7. A publicação pública deve entrar pelo proxy em HTTPS/443; 80 é a entrada HTTP do proxy. O documento marca 5678/5679 como fechadas e a regra TCP 3000 como existente para uso específico, sujeita a validação antes de qualquer alteração.

O pacote usa Nginx para servir arquivos estáticos na porta **interna** 80. Não abre firewall, não publica uma porta do host, não usa a regra 3000 e não se conecta aos bancos, n8n ou Evolution GO.

## Publicar pelo EasyPanel

1. Primeiro carregue o projeto para o repositório indicado em `docs/COMANDOS-GITHUB.md`, revise a branch e faça o merge aprovado para `main`.
2. No EasyPanel, crie uma aplicação/site conectado ao repositório `automacaopaivaimobiliaria26/simuladorcasadosushi` e selecione `main` (ou a branch de homologação, se estiver validando antes do merge).
3. Escolha build a partir de Dockerfile. A configuração deste pacote é o `Dockerfile` da raiz do repositório, com build context `.`.
4. Configure a porta de destino/upstream do contêiner como HTTP `80`. Cadastre o domínio/subdomínio escolhido na aplicação e habilite o certificado HTTPS gerenciado pelo EasyPanel/Traefik.
5. Implante somente essa aplicação. Não altere regras de firewall nem publique `3000`, `5678` ou `5679` no host. Não crie mapeamento público `80:80` ou `443:443`; essas portas pertencem ao proxy do EasyPanel.
6. Verifique a URL pública:

```bash
curl -fsS https://SEU-DOMINIO/healthz
curl -I https://SEU-DOMINIO/
curl -fsS https://SEU-DOMINIO/manus-routes.json
```

Substitua `SEU-DOMINIO` pelo domínio configurado. Se o certificado ou rota não ficar saudável, confira primeiro o domínio e o destino interno `80` no EasyPanel; não abra portas adicionais como tentativa.

## Teste local opcional

Com Docker instalado, na raiz do repositório:

```bash
docker build -t simuladorcasadosushi:local .
docker run --rm -d --name simuladorcasadosushi-test \
  -p 127.0.0.1:18081:80 simuladorcasadosushi:local
curl -fsS http://127.0.0.1:18081/healthz
curl -I http://127.0.0.1:18081/
docker stop simuladorcasadosushi-test
```

O mapeamento do teste fica preso a `127.0.0.1`; não cria exposição pública e não usa a porta 3000.

## Variáveis, dados e privacidade

Não é necessária variável de ambiente, banco, volume persistente ou credencial para servir a página. O contêiner final contém só Nginx e arquivos de `dist/public/`; o estágio de build instala as dependências, roda typecheck/testes e compila o front-end. O Dockerfile e `.dockerignore` excluem segredos, planilhas e documentos do contexto de build.

Importante: as premissas iniciais e as fórmulas que a página precisa usar fazem parte do código cliente. O site não implementa autenticação; qualquer pessoa com acesso à URL pode inspecionar esses dados. Um repositório GitHub público também torna o código visível. Se isso não for aceitável, torne o repositório privado e restrinja o acesso ao site no EasyPanel antes do deploy; a proteção do repositório, sozinha, não protege uma página publicada publicamente.

Os cenários editados persistem no `localStorage` do navegador e da origem. Exporte a configuração em Excel antes de trocar o domínio e importe-a no endereço novo.

## Reversão

Antes de promover, registre o commit atualmente usado pelo EasyPanel. Para reverter uma publicação, selecione no EasyPanel o commit/imagem saudável anterior e reimplante somente a aplicação do simulador. Não há migração de banco neste pacote. Mantenha a branch e o commit anteriores até validar o novo site.
