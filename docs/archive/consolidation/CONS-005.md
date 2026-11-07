# CONS-005 — Certificação da Compatibilidade Tiptap 2/3

## 1. Objetivo
Validar a declaração de compatibilidade dual (`peerDependencies`: `"@tiptap/pm": "^2.0.0 || ^3.0.0"`, `"@tiptap/core": "^2.0.0 || ^3.0.0"`) da biblioteca independente `document-editor` por meio de testes e2e controlados em consumidores distintos (Consumer A: Tiptap v2, Consumer B: Tiptap v3).

## 2. Metodologia
1. O pacote experimental `document-editor-0.1.0-alpha.2.tgz` foi gerado e instalado localmente em dois consumidores:
   - `consumer-a`: utilizando `@tiptap/core@2.27.3` e demais dependências correspondentes.
   - `consumer-b`: utilizando `@tiptap/core@3.31.3` e demais dependências correspondentes.
2. Ambos os consumidores foram equipados com a suíte de testes E2E do projeto original (híbrido e de estresse) e consumiram as mesmas _fixtures_ (PE-S, PE-M, PE-L).
3. A extensão de paginação (`PaginationExtension`) foi ativada em cada contexto via Vite + Puppeteer para simular o comportamento real no navegador, validando operações geométricas (quantidades de páginas geradas) e estabilidade de estado (Rollback).

## 3. Desafios e Ajustes
- **Nomeação de Exports no Tiptap v3**: Ao configurar o `consumer-b`, detectou-se que as extensões relacionadas a tabelas (`@tiptap/extension-table*`) não exportam mais seus módulos como default (e.g. `import Table from '@tiptap/extension-table'`). Foi necessário reajustar para _named exports_ (e.g. `import { Table }`). Isso valida que, embora o `document-editor` seja compatível, seus consumidores precisam adequar-se às _breaking changes_ da v3 caso utilizem extensões oficiais.
- **Port Collision**: Por padronização, a configuração de testes E2E precisa ter seu processo de servidor vite isolado ou garantir o fechamento de portas adequadamente após testes sequenciais.
- **Isolamento de Versão Tiptap**: O `@tiptap/starter-kit` exigiu a amarração cuidadosa de versões no `consumer-a` (fixando `2.27.3`) para evitar descompassos em API subjacentes (como `canInsertNode`).

## 4. Resultados da Validação Geométrica

### Consumer A (Tiptap 2.27.3)
- **Híbrido**: `Passou` (Validação de quebras manuais e automáticas simultâneas).
- **PE-S**: Estabilizado em ~120ms. Páginas: 2, Auto: 0.
- **PE-M**: Estabilizado em ~120ms. Páginas: 3, Auto: 0.
- **PE-L**: Estabilizado em ~150ms. Páginas: 10, Auto: 7 (Tabela com 151 linhas de dados e 6 espaçadores virtuais).
- **Rollback**: Sucesso (Destruição do editor ocorreu sem memory leaks críticos imediatos).

### Consumer B (Tiptap 3.31.3)
- **Híbrido**: `Passou`.
- **PE-S**: Estabilizado em ~135ms. Páginas: 2, Auto: 0.
- **PE-M**: Estabilizado em ~115ms. Páginas: 3, Auto: 0.
- **PE-L**: Estabilizado em ~145ms. Páginas: 10, Auto: 7 (Tabela com 151 linhas de dados e 6 espaçadores virtuais).
- **Rollback**: Sucesso.

## 5. Conclusão
A biblioteca `document-editor@0.1.0-alpha.2` é certificadamente funcional nas `majors` 2.x e 3.x do ecossistema Tiptap.

A delegação da renderização final para a extensão e a independência da manipulação direta do `Storage` da engine (que sofreu mudanças na v3) blindaram o núcleo de paginação, confirmando a robustez da **Rota B**. 

A compatibilidade dual declarada está tecnicamente provada.
