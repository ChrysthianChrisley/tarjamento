// --- DRAG AND DROP VISUAL ---
const appWrapper = document.querySelector('.app-wrapper');

// Previne comportamento padrão do navegador (abrir o arquivo)
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    document.body.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

// Adiciona classe visual ao arrastar
['dragenter', 'dragover'].forEach(eventName => {
    document.body.addEventListener(eventName, () => appWrapper.classList.add('drag-over'), false);
});

['dragleave', 'drop'].forEach(eventName => {
    document.body.addEventListener(eventName, () => appWrapper.classList.remove('drag-over'), false);
});

// Lida com o arquivo solto
document.body.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length) startLoad(files[0]);
});

const { PDFDocument } = PDFLib;

// Elementos UI
const fileInput = document.getElementById('file-input');
const uploadGroup = document.getElementById('upload-group');
const editorGroup = document.getElementById('editor-group');
const actionFooter = document.getElementById('action-footer');
const pdfContainer = document.getElementById('pdf-container');
const itemsCountLabel = document.getElementById('items-count');
const fileNameLabel = document.getElementById('file-name');
const loader = document.getElementById('loader');

// Botões
const btnScanDocs = document.getElementById('btn-scan-docs');
const btnScanEmail = document.getElementById('btn-scan-email');
const btnScanPhone = document.getElementById('btn-scan-phone');
const btnDownload = document.getElementById('download-btn');
const btnNewFile = document.getElementById('new-file');
const btnClearAll = document.getElementById('clear-all');

// Status Labels
const statusDocs = document.getElementById('status-docs');
const statusEmail = document.getElementById('status-email');
const statusPhone = document.getElementById('status-phone');

// Estado Global
let currentFile = null;
let selections = []; 
let stats = {
    docs: 0,
    email: 0,
    phone: 0
};

// --- Configuração de Upload ---
fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) startLoad(e.target.files[0]);
});

btnNewFile.addEventListener('click', () => location.reload());

btnClearAll.addEventListener('click', () => {
    document.querySelectorAll('.text-box').forEach(el => el.classList.remove('selected'));
    selections = [];
    updateTotalCount();
    resetStatus();
});

// --- Carregamento e Renderização ---
async function startLoad(file) {
    toggleLoader(true, "Carregando documento...");
    currentFile = file; 
    fileNameLabel.textContent = file.name;
    
    try {
        const arrayBuffer = await file.arrayBuffer();
        uploadGroup.classList.add('hidden');
        editorGroup.classList.remove('hidden');
        actionFooter.classList.remove('hidden');
        await renderPDF(arrayBuffer);
    } catch (err) {
        console.error(err);
        alert('Erro ao processar o PDF.');
        location.reload();
    } finally {
        toggleLoader(false);
    }
}

async function renderPDF(bytes) {
    pdfContainer.innerHTML = '';
    const data = new Uint8Array(bytes);
    const loadingTask = pdfjsLib.getDocument(data);
    const pdfDoc = await loadingTask.promise;

    for (let i = 1; i <= pdfDoc.numPages; i++) {
        const page = await pdfDoc.getPage(i);
        const viewport = page.getViewport({ scale: 1.5 }); // Escala Visual

        const wrapper = document.createElement('div');
        wrapper.className = 'pdf-page-wrapper';
        wrapper.style.width = `${viewport.width}px`;
        wrapper.style.height = `${viewport.height}px`;

        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport: viewport }).promise;
        
        wrapper.appendChild(canvas);

        // Camada de Texto
        const textContent = await page.getTextContent();
        const textLayer = document.createElement('div');
        textLayer.className = 'text-layer';

        textContent.items.forEach(item => {
            const originalText = item.str;
            if (!originalText.trim()) return;

            const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
            
            // 1. Configurações de Expansão (Geometria para cobrir falhas)
            const expansionFactor = 1.6; // Altura extra para cobrir acentos e pernas de letras (g, j, p)
            const widthBuffer = 9;       // Largura extra (4.5px para cada lado) para evitar vazamento lateral
            const verticalOffset = 0.90; // Elevação da caixa

            // Calcular métricas básicas
            const fontHeight = Math.sqrt((tx[0] * tx[0]) + (tx[1] * tx[1]));
            const totalWidth = item.width * viewport.scale;
            const charSpacing = totalWidth / originalText.length; 
            const visualHeight = fontHeight * expansionFactor;

            // Divide mantendo espaços para cálculo de posição, mas o SmartScanner vai ignorá-los depois
            const parts = originalText.split(/(\s+)/); 
            let currentXOffset = 0; 

            parts.forEach(part => {
                // Se for só espaço, apenas avança o cursor X
                if (part.match(/^\s+$/)) {
                    currentXOffset += part.length * charSpacing;
                    return; 
                }
                
                if (part.length === 0) return;

                const originalWordWidth = part.length * charSpacing;
                const expandedWidth = originalWordWidth + widthBuffer;
                
                const box = document.createElement('div');
                box.className = 'text-box';
                
                // Centraliza a expansão
                const finalX = tx[4] + currentXOffset - (widthBuffer / 2);
                const finalY = tx[5] - (visualHeight * verticalOffset);

                box.style.left = `${finalX}px`;
                box.style.top = `${finalY}px`; 
                box.style.width = `${expandedWidth}px`;
                box.style.height = `${visualHeight}px`;

                // Dados para o sistema (SmartScanner lê o dataset.text)
                box.dataset.page = i - 1;
                box.dataset.text = part;
                
                // Dados geométricos para a rasterização final
                box.dataset.vX = finalX;
                box.dataset.vY = finalY;
                box.dataset.vW = expandedWidth;
                box.dataset.vH = visualHeight;

                box.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleSelection(box);
                });

                textLayer.appendChild(box);
                currentXOffset += originalWordWidth; 
            });
        });

        wrapper.appendChild(textLayer);
        pdfContainer.appendChild(wrapper);
    }
}

// --- Gestão de Seleção ---
// Substitua a função toggleSelection por esta:
function toggleSelection(element, isAuto = false) {
    const id = `p${element.dataset.page}_x${element.dataset.vX}_y${element.dataset.vY}`;
    
    if (element.classList.contains('selected')) {
        // Se já estava selecionado e clicamos de novo, é para remover (desmarcar)
        element.classList.remove('selected');
        // Removemos a marcação de 'auto' se o usuário desmarcar manualmente
        if (!isAuto) delete element.dataset.auto; 
        
        selections = selections.filter(s => s.id !== id);
    } else {
        // Selecionando novo item
        element.classList.add('selected');
        
        // Se foi o robô, marca como auto. Se foi clique manual, garante que não tem a marca.
        if (isAuto) {
            element.dataset.auto = "true";
        } else {
            delete element.dataset.auto;
        }

        selections.push({
            id: id,
            page: parseInt(element.dataset.page),
            x: parseFloat(element.dataset.vX),
            y: parseFloat(element.dataset.vY),
            w: parseFloat(element.dataset.vW),
            h: parseFloat(element.dataset.vH)
        });
    }
    updateTotalCount();
}

// --- AJUSTE DE CONTAGEM VISUAL ---

function updateTotalCount() {
    // 1. Soma dos encontrados (o número que aparece nos botões)
    const totalFoundEntities = stats.docs + stats.email + stats.phone;

    // 2. Soma dos manuais
    // Conta quantas caixas estão selecionadas MAS NÃO têm a etiqueta 'data-auto="true"'
    const manualClicks = document.querySelectorAll('.text-box.selected:not([data-auto="true"])').length;

    // 3. Resultado Final
    const finalCount = totalFoundEntities + manualClicks;

    itemsCountLabel.textContent = finalCount;
}

// --- INTEGRAÇÃO: REGEX E SMART SCANNER ---

// 1. CPF e CNPJ: Exigem pontuação correta e ignoram rótulos colados.
// O (?:^|[^\d]) garante que não pegue meio de números. 
// O (?!\d) garante que não pegue início de números maiores.
const REGEX_CPF = /(?:^|[^\d])(\d{3}\.\d{3}\.\d{3}-\d{2})(?!\d)/g;
const REGEX_CNPJ = /(?:^|[^\d])(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})(?!\d)/g;

// 2. E-mail: Padrão robusto
const REGEX_EMAIL = /[\w\.-]+@[\w\.-]+\.\w{2,}/g;

// 3. Telefone: Modo Estrito
// Aceita: (XX) XXXX-XXXX, XX XXXXX-XXXX ou XXXX-XXXX
// Requer parênteses no DDD OU traço no número.
// Rejeita sequências numéricas puras (como chaves de acesso ou NFs)
const REGEX_PHONE = /(?:\(\d{2}\)\s?\d{4,5}[-\s]?\d{4})|(?:\d{2}\s\d{4,5}[-\s]\d{4})|(?:\b\d{4,5}-\d{4}\b)/g;


function runSmartScanner(regex) {
    let totalEntitiesFound = 0;
    const pages = document.querySelectorAll('.pdf-page-wrapper');

    pages.forEach((pageWrapper) => {
        const boxes = Array.from(pageWrapper.querySelectorAll('.text-box'));
        if (boxes.length === 0) return;

        // 1. Montagem do Texto Unificado da Página
        let fullText = "";
        const charMap = []; 

        boxes.forEach(box => {
            const text = box.dataset.text || "";
            if(!text) return; // Pula caixas vazias

            // Mapeia cada caractere do texto unificado de volta para sua caixa de origem
            for (let i = 0; i < text.length; i++) {
                charMap.push(box);
            }
            fullText += text;
        });

        // 2. Busca e Seleção
        regex.lastIndex = 0;
        let match;

        while ((match = regex.exec(fullText)) !== null) {
            totalEntitiesFound++;
            
            let matchText = match[0];
            let matchIndex = match.index;

            // Ajuste para Grupos de Captura (CPF/CNPJ)
            // Se o regex usou parênteses de captura (match[1]), usamos apenas o conteúdo capturado.
            // Isso serve para ignorar o caractere de fronteira ou rótulo (ex: o ":" em "CPF:123")
            if (match[1]) {
                matchText = match[1];
                // Desloca o índice inicial para onde começa o grupo capturado
                matchIndex += match[0].indexOf(match[1]); 
            }

            const endIndex = matchIndex + matchText.length;

            // 3. Marcação das Caixas
            for (let i = matchIndex; i < endIndex; i++) {
                const boxOwner = charMap[i];
                if (boxOwner && !boxOwner.classList.contains('selected')) {
                    toggleSelection(boxOwner, true); 
                }
            }
        }
    });

    updateTotalCount();
    return totalEntitiesFound;
}

// --- Listeners dos Botões de Detecção ---

// Substitua os listeners antigos por estes:

btnScanDocs.addEventListener('click', () => {
    // Zera anterior para não duplicar na soma se clicar 2x
    stats.docs = 0; 
    stats.docs += runSmartScanner(REGEX_CPF);
    stats.docs += runSmartScanner(REGEX_CNPJ);
    statusDocs.textContent = `${stats.docs} encontrados`;
    updateTotalCount(); // Recalcula o total geral
});

btnScanEmail.addEventListener('click', () => {
    stats.email = runSmartScanner(REGEX_EMAIL);
    statusEmail.textContent = `${stats.email} encontrados`;
    updateTotalCount();
});

btnScanPhone.addEventListener('click', () => {
    stats.phone = runSmartScanner(REGEX_PHONE);
    statusPhone.textContent = `${stats.phone} encontrados`;
    updateTotalCount();
});

function resetStatus() {
    [statusDocs, statusEmail, statusPhone].forEach(el => el.textContent = '--');
}

// --- GERAÇÃO SEGURA (RASTERIZAÇÃO) ---
btnDownload.addEventListener('click', async () => {
    if (selections.length === 0) return alert("Nada selecionado para ocultar.");
    
    const originalText = btnDownload.innerHTML;
    btnDownload.innerHTML = `
        <svg class="spinner" style="width:16px;height:16px;border-width:2px;margin-right:8px" viewBox="0 0 50 50"></svg>
        Gerando...
    `;
    btnDownload.disabled = true;

    try {
        // Recarrega o PDF original limpo para garantir qualidade
        const freshBuffer = await currentFile.arrayBuffer();
        const pdfDocData = await pdfjsLib.getDocument(new Uint8Array(freshBuffer)).promise;
        
        const newPdfDoc = await PDFDocument.create();
        
        // Alta resolução para que o texto não fique pixelado ao imprimir
        const printScale = 2.0; 
        const visualScale = 1.5; // A escala que usamos na tela (precisa coincidir com renderPDF)

        for (let i = 1; i <= pdfDocData.numPages; i++) {
            toggleLoader(true, `Processando e queimando pág. ${i}/${pdfDocData.numPages}...`);
            
            const page = await pdfDocData.getPage(i);
            const viewport = page.getViewport({ scale: printScale });

            // Cria canvas em memória
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext('2d');

            // 1. Renderiza a página original
            await page.render({ canvasContext: ctx, viewport: viewport }).promise;

            // 2. "Queima" as tarjas pretas permanentemente na imagem
            const ratio = printScale / visualScale;
            const pageSelections = selections.filter(s => s.page === (i - 1));
            
            ctx.fillStyle = "#000000";
            pageSelections.forEach(rect => {
                ctx.fillRect(
                    rect.x * ratio,
                    rect.y * ratio, 
                    rect.w * ratio, 
                    rect.h * ratio
                );
            });

            // 3. Converte para JPG (achatando tudo numa camada só)
            const imgDataUrl = canvas.toDataURL('image/jpeg', 0.85);
            const imgBytes = await fetch(imgDataUrl).then(res => res.arrayBuffer());

            // 4. Insere a imagem como página no novo PDF
            const jpgImage = await newPdfDoc.embedJpg(imgBytes);
            
            // Ajusta o tamanho da imagem para o tamanho original da página PDF
            const jpgDims = jpgImage.scale(1 / printScale); 

            const newPage = newPdfDoc.addPage([jpgDims.width, jpgDims.height]);
            newPage.drawImage(jpgImage, {
                x: 0,
                y: 0,
                width: jpgDims.width,
                height: jpgDims.height,
            });
        }

        const pdfBytes = await newPdfDoc.save();
        download(pdfBytes, `Tarjamento_Seguro_${Date.now()}.pdf`, "application/pdf");

    } catch (error) {
        console.error(error);
        alert("Erro na geração. Verifique o console.");
    } finally {
        toggleLoader(false);
        btnDownload.innerHTML = originalText;
        btnDownload.disabled = false;
    }
});

function toggleLoader(show, text = "Processando...") {
    loader.querySelector('p').textContent = text;
    if (show) loader.classList.remove('hidden');
    else loader.classList.add('hidden');
}