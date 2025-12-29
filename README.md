# Tarjamento

**Anonimização de PDFs segura, offline e definitiva.**

O **Tarjamento** é uma ferramenta web para ocultar dados sensíveis em documentos PDF. Diferente de outras soluções, todo o processamento é realizado **localmente no navegador do usuário (Client-Side)**, garantindo que nenhum documento jamais seja enviado para servidores externos. Ideal para adequação à **LGPD** (Lei Geral de Proteção de Dados).

![Status](https://img.shields.io/badge/Status-Estável-green)
![Privacy](https://img.shields.io/badge/Privacy-100%25_Offline-blue)
![License](https://img.shields.io/badge/License-MIT-yellow)

## Funcionalidades Principais

* **Smart Scanner:** Algoritmo capaz de detectar dados (CPF, CNPJ, Telefones) mesmo quando o PDF fragmenta os números em múltiplas caixas de texto ou linhas diferentes.
* **Rasterização Segura:** O PDF final não apenas coloca uma tarja preta sobre o texto; ele converte a página em uma imagem (JPG) de alta resolução e a re-encapsula em um novo PDF. Isso impede que o texto original seja recuperado via "Copiar/Colar" ou inspeção de código oculta.
* **Detecção Automática:**
    * **Documentos:** CPF e CNPJ (validação de padrões e pontuação).
    * **Contatos:** E-mails e Telefones (Formatos Fixos e Celulares).
* **Seleção Manual:** Clique em qualquer palavra ou frase do documento para aplicar a tarja instantaneamente.
* **Privacidade Total:** Funciona sem internet. O arquivo nunca sai da máquina do usuário.

## Como Usar

### Opção 1: Rodar Localmente
Basta clonar o repositório e abrir o arquivo `index.html` no seu navegador. Não requer instalação de Node.js, Python ou servidores web complexos.

```bash
git clone [https://github.com/SEU-USUARIO/tarjamento.git](https://github.com/SEU-USUARIO/tarjamento.git)
cd tarjamento
# Abra o arquivo index.html no Chrome, Firefox ou Edge