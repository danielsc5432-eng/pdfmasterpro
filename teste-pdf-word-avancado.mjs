import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const Q = path.join(process.env.TEMP, "opencode", "pdf-word-testes");
await mkdir(Q, { recursive: true });

async function criarPdfDificil1() {
  // Tabelas complexas, multi-coluna simulado, cabeçalhos, rodapés
  const doc = await PDFDocument.create();
  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const helvB = await doc.embedFont(StandardFonts.HelveticaBold);
  const times = await doc.embedFont(StandardFonts.TimesRoman);
  const timesB = await doc.embedFont(StandardFonts.TimesRomanBold);
  
  const page = doc.addPage([595, 842]);
  const { width, height } = page.getSize();
  
  // Cabeçalho
  page.drawText("EMPRESA EXEMPLO LTDA - RELATÓRIO ANUAL 2025", { x: 50, y: height - 40, size: 10, font: helvB });
  page.drawLine({ start: { x: 50, y: height - 45 }, end: { x: width - 50, y: height - 45 }, thickness: 0.5, color: rgb(0.2, 0.2, 0.2) });
  
  // Título
  page.drawText("DEMONSTRAÇÃO FINANCEIRA CONSOLIDADA", { x: 50, y: height - 80, size: 16, font: timesB });
  page.drawText("Exercício findo em 31 de dezembro de 2025", { x: 50, y: height - 100, size: 10, font: times });
  
  // Tabela complexa com bordas
  let y = height - 140;
  // Header
  page.drawRectangle({ x: 50, y: y - 5, width: 495, height: 20, color: rgb(0.9, 0.9, 0.95) });
  page.drawText("CONTA", { x: 55, y, size: 9, font: helvB });
  page.drawText("2025 (R$)", { x: 250, y, size: 9, font: helvB });
  page.drawText("2024 (R$)", { x: 350, y, size: 9, font: helvB });
  page.drawText("VARIAÇÃO %", { x: 450, y, size: 9, font: helvB });
  y -= 20;
  
  const rows = [
    ["Receita Operacional Bruta", "1.234.567,89", "1.123.456,78", "+9,89%"],
    ["(-) Deduções da Receita", "(123.456,78)", "(112.345,67)", "+9,89%"],
    ["RECEITA OPERACIONAL LÍQUIDA", "1.111.111,11", "1.011.111,11", "+9,90%"],
    ["(-) Custos dos Produtos Vendidos", "(555.555,55)", "(505.555,55)", "+9,90%"],
    ["LUCRO BRUTO", "555.555,56", "505.555,56", "+9,90%"],
    ["(-) Despesas Operacionais", "(333.333,33)", "(303.333,33)", "+9,90%"],
    ["LUCRO OPERACIONAL", "222.222,23", "202.222,23", "+9,90%"],
    ["(-) Resultado Financeiro", "(11.111,11)", "(10.111,11)", "+9,90%"],
    ["LUCRO ANTES DOS TRIBUTOS", "211.111,12", "192.111,12", "+9,89%"],
    ["(-) Imposto de Renda", "(63.333,34)", "(57.633,34)", "+9,88%"],
    ["LUCRO LÍQUIDO", "147.777,78", "134.477,78", "+9,88%"],
  ];
  
  for (let i = 0; i < rows.length; i++) {
    if (i === 2 || i === 4 || i === 6 || i === 9 || i === 10) {
      page.drawRectangle({ x: 50, y: y - 5, width: 495, height: 18, color: rgb(0.97, 0.97, 0.97) });
    }
    page.drawText(rows[i][0], { x: 55, y, size: 8, font: i >= 9 ? helvB : helv });
    page.drawText(rows[i][1], { x: 250, y, size: 8, font: i >= 9 ? helvB : helv });
    page.drawText(rows[i][2], { x: 350, y, size: 8, font: i >= 9 ? helvB : helv });
    page.drawText(rows[i][3], { x: 450, y, size: 8, font: i >= 9 ? helvB : helv });
    page.drawLine({ start: { x: 50, y: y - 7 }, end: { x: 545, y: y - 7 }, thickness: 0.3, color: rgb(0.8, 0.8, 0.8) });
    y -= 18;
  }
  
  // Texto com formatação
  y -= 30;
  page.drawText("Notas Explicativas:", { x: 50, y, size: 12, font: helvB });
  y -= 20;
  page.drawText("1. As demonstrações financeiras foram elaboradas em conformidade com as normas brasileiras", { x: 50, y, size: 9, font: helv });
  y -= 12;
  page.drawText("   de contabilidade e com os pronunciamentos do Comitê de Pronunciamentos Contábeis (CPC).", { x: 50, y, size: 9, font: helv });
  y -= 18;
  page.drawText("2. A Receita Operacional Bruta inclui vendas de mercadorias, prestação de serviços e outras receitas", { x: 50, y, size: 9, font: helv });
  y -= 12;
  page.drawText("   operacionais, deduzidas das devoluções, descontos comerciais e impostos sobre vendas.", { x: 50, y, size: 9, font: helv });
  
  // Rodapé
  page.drawLine({ start: { x: 50, y: 40 }, end: { x: width - 50, y: 40 }, thickness: 0.5, color: rgb(0.2, 0.2, 0.2) });
  page.drawText("Página 1 de 2 | Documento Confidencial", { x: 50, y: 30, size: 8, font: helv });
  
  // Página 2
  const page2 = doc.addPage([595, 842]);
  page2.drawText("EMPRESA EXEMPLO LTDA - RELATÓRIO ANUAL 2025", { x: 50, y: height - 40, size: 10, font: helvB });
  page2.drawLine({ start: { x: 50, y: height - 45 }, end: { x: width - 50, y: height - 45 }, thickness: 0.5, color: rgb(0.2, 0.2, 0.2) });
  
  page2.drawText("ANÁLISE POR SEGMENTO DE ATUAÇÃO", { x: 50, y: height - 80, size: 14, font: timesB });
  
  // Tabela com 2 colunas mais largas
  y = height - 120;
  page2.drawRectangle({ x: 50, y: y - 5, width: 495, height: 18, color: rgb(0.9, 0.9, 0.95) });
  page2.drawText("SEGMENTO", { x: 55, y, size: 9, font: helvB });
  page2.drawText("RECEITA", { x: 200, y, size: 9, font: helvB });
  page2.drawText("LUCRO", { x: 290, y, size: 9, font: helvB });
  page2.drawText("MARGEM", { x: 380, y, size: 9, font: helvB });
  page2.drawText("COLABORADORES", { x: 460, y, size: 9, font: helvB });
  y -= 18;
  
  const segs = [
    ["Varejo", "456.789,00", "89.456,00", "19,58%", "245"],
    ["Atacado", "345.678,00", "67.890,00", "19,65%", "178"],
    ["E-commerce", "289.456,00", "56.789,00", "19,62%", "92"],
    ["Serviços", "142.644,00", "33.642,78", "23,58%", "67"],
  ];
  for (const s of segs) {
    page2.drawText(s[0], { x: 55, y, size: 9, font: helv });
    page2.drawText(s[1], { x: 200, y, size: 9, font: helv });
    page2.drawText(s[2], { x: 290, y, size: 9, font: helv });
    page2.drawText(s[3], { x: 380, y, size: 9, font: helv });
    page2.drawText(s[4], { x: 460, y, size: 9, font: helv });
    page2.drawLine({ start: { x: 50, y: y - 7 }, end: { x: 545, y: y - 7 }, thickness: 0.3, color: rgb(0.8, 0.8, 0.8) });
    y -= 16;
  }
  
  page2.drawText("TOTAL", { x: 55, y, size: 9, font: helvB });
  page2.drawText("1.234.567,00", { x: 200, y, size: 9, font: helvB });
  page2.drawText("247.777,78", { x: 290, y, size: 9, font: helvB });
  page2.drawText("20,07%", { x: 380, y, size: 9, font: helvB });
  page2.drawText("582", { x: 460, y, size: 9, font: helvB });
  
  page2.drawLine({ start: { x: 50, y: 40 }, end: { x: width - 50, y: 40 }, thickness: 0.5, color: rgb(0.2, 0.2, 0.2) });
  page2.drawText("Página 2 de 2 | Documento Confidencial", { x: 50, y: 30, size: 8, font: helv });
  
  const pdfBytes = await doc.save();
  await writeFile(path.join(Q, "01_tabela_complexa.pdf"), pdfBytes);
  console.log("Criado: 01_tabela_complexa.pdf");
}

async function criarPdfDificil2() {
  // Duas colunas (jornal/revista)
  const doc = await PDFDocument.create();
  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const helvB = await doc.embedFont(StandardFonts.HelveticaBold);
  const times = await doc.embedFont(StandardFonts.TimesRoman);
  const timesB = await doc.embedFont(StandardFonts.TimesRomanBold);
  
  const page = doc.addPage([595, 842]);
  const { width, height } = page.getSize();
  
  page.drawText("JORNAL TECNOLÓGICO - EDIÇÃO ESPECIAL", { x: 50, y: height - 40, size: 12, font: helvB });
  page.drawLine({ start: { x: 50, y: height - 45 }, end: { x: width - 50, y: height - 45 }, thickness: 1, color: rgb(0, 0, 0) });
  
  page.drawText("INTELIGÊNCIA ARTIFICIAL TRANSFORMA O MERCADO", { x: 50, y: height - 75, size: 18, font: timesB });
  page.drawText("Por Maria Santos | São Paulo, 22 de outubro de 2026", { x: 50, y: height - 92, size: 9, font: helv });
  
  const col1X = 50;
  const col2X = 325;
  const colWidth = 220;
  
  let y1 = height - 125;
  const textoCol1 = [
    "A inteligência artificial generativa tem revolucionado",
    "a forma como empresas de todos os portes abordam",
    "sua produtividade e inovação. Grandes modelos de",
    "linguagem estão sendo integrados a fluxos de trabalho",
    "corporativos em velocidade sem precedentes.",
    "",
    "Especialistas apontam que a adoção da IA não se trata",
    "mais de uma questão de 'se' mas sim de 'quando' e",
    "'como'. As organizações que demorarem a se adaptar",
    "correm o risco de perder competitividade no mercado",
    "global cada vez mais dinâmico.",
    "",
    "Além da automação de tarefas repetitivas, a IA está",
    "sendo utilizada para análise preditiva, atendimento",
    "ao cliente, desenvolvimento de software e até mesmo",
    "em decisões estratégicas complexas.",
  ];
  
  for (const t of textoCol1) {
    if (t === "") { y1 -= 8; continue; }
    page.drawText(t, { x: col1X, y: y1, size: 9, font: times, maxWidth: colWidth });
    y1 -= 11;
  }
  
  let y2 = height - 125;
  const textoCol2 = [
    "Os investimentos em IA atingiram níveis recordes",
    "em 2025, com mais de 200 bilhões de dólares aplicados",
    "globalmente. O Brasil tem acompanhado essa tendência",
    "com crescimento significativo no setor de startups.",
    "",
    "No entanto, especialistas alertam para os desafios",
    "éticos e regulatórios. Questões como viés algorítmico,",
    "privacidade de dados e responsabilidade pela tomada",
    "de decisões automatizadas precisam ser endereçadas.",
    "",
    "A regulamentação da IA no Brasil está em discussão",
    "no Congresso Nacional, com propostas que buscam",
    "equilibrar inovação e proteção aos direitos fundamentais",
    "dos cidadãos.",
    "",
    "Empresas que adotarem uma abordagem responsável",
    "devem sair na frente, construindo confiança com",
    "clientes e colaboradores ao mesmo tempo em que",
    "impulsionam sua transformação digital.",
  ];
  
  for (const t of textoCol2) {
    if (t === "") { y2 -= 8; continue; }
    page.drawText(t, { x: col2X, y: y2, size: 9, font: times, maxWidth: colWidth });
    y2 -= 11;
  }
  
  // Linha vertical separando colunas
  page.drawLine({ start: { x: 297.5, y: height - 125 }, end: { x: 297.5, y: 60 }, thickness: 0.3, color: rgb(0.7, 0.7, 0.7) });
  
  page.drawLine({ start: { x: 50, y: 50 }, end: { x: width - 50, y: 50 }, thickness: 1, color: rgb(0, 0, 0) });
  page.drawText("www.exemplo.com.br | jornal@exemplo.com.br", { x: 50, y: 40, size: 8, font: helv });
  
  const pdfBytes = await doc.save();
  await writeFile(path.join(Q, "02_duas_colunas.pdf"), pdfBytes);
  console.log("Criado: 02_duas_colunas.pdf");
}

async function criarPdfDificil3() {
  // Formulário com campos, listas numeradas, sublistas
  const doc = await PDFDocument.create();
  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const helvB = await doc.embedFont(StandardFonts.HelveticaBold);
  
  const page = doc.addPage([595, 842]);
  const { width, height } = page.getSize();
  
  page.drawText("FORMULÁRIO DE CADASTRO - PESSOA JURÍDICA", { x: 50, y: height - 50, size: 14, font: helvB });
  page.drawLine({ start: { x: 50, y: height - 55 }, end: { x: width - 50, y: height - 55 }, thickness: 1, color: rgb(0, 0.4, 0.8) });
  
  let y = height - 90;
  const campos = [
    "Razão Social: _____________________________",
    "Nome Fantasia: ___________________________",
    "CNPJ: _____._____._____/_____-__",
    "Inscrição Estadual: _______________________",
    "Endereço: ________________________________",
    "Cidade: _________________________________",
    "Estado: ___________ CEP: ____._____-___",
    "Telefone: (____) ________________________",
    "E-mail: _________________________________",
  ];
  for (const c of campos) {
    page.drawText(c, { x: 50, y, size: 10, font: helv });
    y -= 22;
  }
  
  y -= 20;
  page.drawText("ATIVIDADES ECONÔMICAS:", { x: 50, y, size: 11, font: helvB });
  y -= 18;
  const atividades = [
    "1. Comércio varejista de mercadorias em geral",
    "   1.1. Vestuário e acessórios",
    "   1.2. Calçados e artigos de couro",
    "   1.3. Cosméticos e produtos de higiene",
    "2. Prestação de serviços",
    "   2.1. Consultoria empresarial",
    "   2.2. Assessoria contábil e tributária",
    "   2.3. Desenvolvimento de software",
    "3. Comércio atacadista",
    "   3.1. Distribuição de produtos alimentícios",
    "   3.2. Materiais de construção",
  ];
  for (const a of atividades) {
    page.drawText(a, { x: 50, y, size: 9, font: helv });
    y -= 14;
  }
  
  y -= 30;
  page.drawText("OBSERVAÇÕES:", { x: 50, y, size: 11, font: helvB });
  page.drawRectangle({ x: 50, y: y - 80, width: 495, height: 70, borderColor: rgb(0.6, 0.6, 0.6), borderWidth: 0.5 });
  
  const pdfBytes = await doc.save();
  await writeFile(path.join(Q, "03_formulario_listas.pdf"), pdfBytes);
  console.log("Criado: 03_formulario_listas.pdf");
}

async function criarPdfDificil4() {
  // Layout misto com texto em diferentes posições, notas de rodapé
  const doc = await PDFDocument.create();
  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const helvB = await doc.embedFont(StandardFonts.HelveticaBold);
  const times = await doc.embedFont(StandardFonts.TimesRoman);
  
  const page = doc.addPage([595, 842]);
  const { width, height } = page.getSize();
  
  page.drawText("Artigo Científico", { x: 50, y: height - 50, size: 18, font: helvB });
  page.drawText("Título: Análise Comparativa de Algoritmos de Aprendizado de Máquina", { x: 50, y: height - 75, size: 12, font: helvB });
  page.drawText("Autores: João Silva¹, Maria Oliveira², Pedro Santos¹", { x: 50, y: height - 95, size: 10, font: helv });
  page.drawText("¹Universidade Federal - Departamento de Ciência da Computação", { x: 50, y: height - 110, size: 9, font: helv });
  page.drawText("²Instituto de Pesquisa Avançada", { x: 50, y: height - 122, size: 9, font: helv });
  
  page.drawText("Resumo", { x: 50, y: height - 150, size: 12, font: helvB });
  const resumo = [
    "Este trabalho apresenta uma análise comparativa entre diferentes algoritmos de aprendizado",
    "de máquina aplicados à classificação de dados. Foram testados cinco algoritmos distintos",
    "em três bases de dados públicas, avaliando acurácia, precisão, recall e tempo de execução.",
    "Os resultados demonstram que o algoritmo XGBoost apresentou melhor desempenho na maioria",
    "dos cenários testados, com acurácia superior a 95% nas bases avaliadas.",
  ];
  let y = height - 168;
  for (const r of resumo) { page.drawText(r, { x: 50, y, size: 9, font: times, maxWidth: width - 100 }); y -= 12; }
  
  page.drawText("1. Introdução", { x: 50, y: y - 20, size: 12, font: helvB });
  y -= 38;
  const intro = [
    "O aprendizado de máquina tem se tornado uma ferramenta fundamental em diversas áreas",
    "do conhecimento, desde medicina até finanças. A escolha do algoritmo adequado para",
    "cada problema é crucial para obter resultados satisfatórios¹.",
    "",
    "Neste trabalho, buscamos responder à seguinte questão de pesquisa: qual algoritmo",
    "apresenta melhor desempenho geral considerando diferentes tipos de dados? Para",
    "responder a essa pergunta, realizamos experimentos controlados em ambiente reproduzível.",
  ];
  for (const r of intro) { if (r === "") { y -= 6; continue; } page.drawText(r, { x: 50, y, size: 9, font: times, maxWidth: width - 100 }); y -= 12; }
  
  page.drawText("2. Metodologia", { x: 50, y: y - 20, size: 12, font: helvB });
  y -= 38;
  const met = [
    "2.1. Bases de Dados",
    "Utilizamos três bases de dados públicas do repositório UCI Machine Learning²:",
    "",
    "   • Iris Dataset - 150 amostras, 4 atributos",
    "   • Wine Dataset - 178 amostras, 13 atributos", 
    "   • Breast Cancer Dataset - 569 amostras, 30 atributos",
    "",
    "2.2. Algoritmos Avaliados",
    "Foram avaliados: Random Forest, SVM, XGBoost, Naive Bayes e Rede Neural Artificial.",
  ];
  for (const r of met) { if (r === "") { y -= 6; continue; } page.drawText(r, { x: 50, y, size: 9, font: times, maxWidth: width - 100 }); y -= 12; }
  
  // Notas de rodapé
  page.drawText("¹ Ver Vapnik (1995) para fundamentação teórica.", { x: 50, y: 55, size: 8, font: helv });
  page.drawText("² Disponível em: https://archive.ics.uci.edu/ml/", { x: 50, y: 45, size: 8, font: helv });
  page.drawLine({ start: { x: 50, y: 62 }, end: { x: width - 50, y: 62 }, thickness: 0.3, color: rgb(0.5, 0.5, 0.5) });
  
  const pdfBytes = await doc.save();
  await writeFile(path.join(Q, "04_artigo_cientifico.pdf"), pdfBytes);
  console.log("Criado: 04_artigo_cientifico.pdf");
}

async function criarPdfDificil5() {
  // PDF com tabelas muito largas, números, datas
  const doc = await PDFDocument.create();
  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const helvB = await doc.embedFont(StandardFonts.HelveticaBold);
  const cour = await doc.embedFont(StandardFonts.Courier);
  
  const page = doc.addPage([842, 595]); // Landscape A4
  const { width, height } = page.getSize();
  
  page.drawText("BOLETIM DIÁRIO DE NEGOCIAÇÕES - B3", { x: 50, y: height - 40, size: 12, font: helvB });
  page.drawText("Data: 22/10/2026", { x: width - 150, y: height - 40, size: 10, font: helv });
  page.drawLine({ start: { x: 50, y: height - 45 }, end: { x: width - 50, y: height - 45 }, thickness: 0.5, color: rgb(0, 0, 0) });
  
  let y = height - 70;
  page.drawRectangle({ x: 50, y: y - 5, width: width - 100, height: 16, color: rgb(0.9, 0.9, 0.95) });
  const cols = ["CÓDIGO", "ATIVO", "ABERTURA", "MÁXIMA", "MÍNIMA", "FECHAMENTO", "VARIAÇÃO", "VOLUME", "NEGÓCIOS"];
  const xCols = [55, 120, 220, 310, 400, 490, 580, 670, 750];
  for (let i = 0; i < cols.length; i++) page.drawText(cols[i], { x: xCols[i], y, size: 7, font: helvB });
  y -= 16;
  
  const dados = [
    ["PETR4", "PETROBRAS PN", "38,45", "39,12", "38,32", "38,98", "+1,38%", "125.456.789", "45.678"],
    ["VALE3", "VALE ON", "62,34", "63,45", "62,10", "63,21", "+1,40%", "98.765.432", "38.456"],
    ["ITUB4", "ITAU UNIBANCO PN", "32,56", "33,01", "32,45", "32,89", "+1,01%", "87.654.321", "32.345"],
    ["BBDC4", "BRADESCO PN", "14,23", "14,56", "14,18", "14,45", "+1,55%", "76.543.210", "28.901"],
    ["BBAS3", "BRASIL ON", "54,32", "55,10", "54,20", "54,98", "+1,22%", "65.432.109", "25.678"],
    ["ABEV3", "AMBEV ON", "12,45", "12,67", "12,38", "12,56", "+0,88%", "54.321.098", "21.456"],
    ["WEGE3", "WEG ON", "42,34", "43,21", "42,15", "43,05", "+1,68%", "43.210.987", "18.765"],
    ["RENT3", "LOCALIZA ON", "58,76", "59,43", "58,54", "59,32", "+0,95%", "32.109.876", "15.432"],
  ];
  
  for (const row of dados) {
    for (let i = 0; i < row.length; i++) {
      page.drawText(row[i], { x: xCols[i], y, size: 7, font: i >= 2 && i <= 6 ? cour : helv });
    }
    page.drawLine({ start: { x: 50, y: y - 4 }, end: { x: width - 50, y: y - 4 }, thickness: 0.2, color: rgb(0.85, 0.85, 0.85) });
    y -= 14;
  }
  
  const pdfBytes = await doc.save();
  await writeFile(path.join(Q, "05_tabela_larga_landscape.pdf"), pdfBytes);
  console.log("Criado: 05_tabela_larga_landscape.pdf");
}

await criarPdfDificil1();
await criarPdfDificil2();
await criarPdfDificil3();
await criarPdfDificil4();
await criarPdfDificil5();
console.log("\nTodos os PDFs difíceis criados em:", Q);
