# ADR-001: Consolidação do Projeto document-editor

## Status
Aceito

## Contexto
O laboratório `editor-lab` alcançou maturidade arquitetural (Baseline 0.2.2) fornecendo suporte confiável a tabelas gigantescas de 150 linhas processadas em cerca de ~540ms, além da correta separação entre Rota B (Decorations em Frontend) e JSON puro semântico para uso pelo OpenPDF. Contudo, como o laboratório é composto por dezenas de `commits`, códigos duplicados (EXP-X) e configurações impuras, não servia para se tornar a fonte principal do pacote.

## Decisão
Extrair o pacote oficial `document-editor`, dissociando a base de testes isolados e logs históricos experimentais, migrando e documentando estritamente os contratos operacionais que alimentam a `PaginationExtension`.
- O laboratório `editor-lab` passa a ser um arquivo puramente histórico.
- O `document-editor` passará a conter a implementação funcional canônica da infraestrutura de edição acadêmica.
- O APPE permanece o consumidor institucional principal (podendo puxar o pacote npm isolado futuramente).
- A API documentada deve prezar sempre pelos serviços vigentes. Funcionalidades inacabadas deverão existir apenas em branchs isoladas.

## Consequências
Um empacotamento simplificado via Vite (ESM, UMD e Declarações Tipadas) que independe do laboratório, com scripts E2E e um projeto consumidor agnóstico no formato de Workspace / Vanilla Typescript. Isso minimiza riscos de empacotamentos confusos que quebrem os pipelines de homologação contínua.
