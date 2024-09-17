const xmlContainer = document.getElementById('xml-container');
xmlContainer.style.display = 'block';
const xmlDiv = document.getElementById('xml-div');

const img = document.querySelector('img');
img.addEventListener('click', () => {
    const dialog = document.createElement('dialog');
    const img2 = document.createElement('img');
    img2.src = img.src;
    img2.style.height = '70vh';
    img2.onclick = () => {
        dialog.remove();
    };
    dialog.appendChild(img2);
    const closeBtn = document.createElement('div');
    closeBtn.textContent = '✕';
    closeBtn.classList.add('close-btn');
    dialog.appendChild(closeBtn);
    closeBtn.onclick = () => dialog.remove();
    document.body.appendChild(dialog);
    dialog.showModal();
});

const txmSpan = document.getElementById('TXM');
const txmDialog = document.getElementById('txm-dialog');
const okBtn = txmDialog.querySelector('button');
txmSpan.addEventListener('click', () => {
    txmDialog.showModal();
});
okBtn.addEventListener('click', () => {
    txmDialog.close();
});

const addBtn = document.getElementById('add-btn');
let index = 0;
addCorpus();
addBtn.addEventListener('click', () => {
    addCorpus();
});

let corpora = [];
function addCorpus() {
    const newXmlDiv = xmlDiv.cloneNode(true);
    newXmlDiv.style.display = 'block';
    index++;
    const corpusNb = newXmlDiv.querySelector('div.corpus-nb');
    corpusNb.textContent = `Corpus n°${index}`;
    addBtn.before(newXmlDiv);
    const corpusNameInput = newXmlDiv.querySelector('input.corpus-name');
    const langSelect = newXmlDiv.querySelector('select.lang-select');
    let lang = 'fr';
    langSelect.addEventListener('change', () => {
        lang = langSelect.value;
    });
    let corpusFiles;
    const xmlInput = newXmlDiv.querySelector('input.xml-input');
    xmlInput.addEventListener('change', (event) => {
        let corpusName;
        if (corpusNameInput.value) {
            corpusName = corpusNameInput.value;
        } else {
            corpusName = corpusNb.textContent;
        }
        corpusFiles = Array.from(event.target.files);
        corpusFiles.sort((a, b) => {
            return a.name.localeCompare(b.name);
        });
        const fileNbSpan = newXmlDiv.querySelector('span.file-nb');
        const fileNames = [];
        for (let f of corpusFiles) {
            fileNames.push(f.name);
        }
        fileNbSpan.textContent = `${
            corpusFiles.length
        } fichier(s) : ${fileNames.join(', ')}`;
        corpora.push({ name: corpusName, lang: lang, files: corpusFiles });
    });
}

let typeChoice = 'types';
const typeChoiceSelect = document.getElementById('type-choice');
typeChoiceSelect.addEventListener('change', () => {
    typeChoice = typeChoiceSelect.value;
});

const intervalInput = document.getElementById('interval-input');

const counterSpan = document.getElementById('counter');
async function computeTTRFromXml(corpusName, lang, corpusFiles) {
    const lemmas = new Set();
    const ttrValues = [];
    if (corpusFiles.length > 0) {
        for (let i = 0; i < corpusFiles.length; i++) {
            counterSpan.textContent = `${corpusName} : traitement du fichier ${
                i + 1
            } sur ${corpusFiles.length}`;
            if (corpusFiles[i].type === 'text/xml') {
                let xmlString = await readXML(corpusFiles[i]);
                function readXML(xmlFile) {
                    return new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onload = function (e) {
                            const xmlString = e.target.result;
                            resolve(xmlString);
                        };
                        reader.readAsText(xmlFile);
                    });
                }
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(
                    xmlString,
                    'application/xml'
                );
                const words = xmlDoc.getElementsByTagName('w');
                for (let j = 0; j < words.length; j++) {
                    if (typeChoice === 'types') {
                        const lemma = words[j]
                            .getElementsByTagName('txm:form')[0]
                            .textContent.toLowerCase();
                        lemmas.add(lemma);
                        const ttr = lemmas.size;
                        ttrValues.push(ttr);
                    } else if (typeChoice === 'lemmas') {
                        const anaElements =
                            words[j].getElementsByTagName('txm:ana');
                        for (let k = 0; k < anaElements.length; k++) {
                            if (
                                anaElements[k].getAttribute('type') ===
                                `#${lang}lemma`
                            ) {
                                const lemma =
                                    anaElements[k].textContent.toLowerCase();
                                lemmas.add(lemma);
                                const ttr = lemmas.size;
                                ttrValues.push(ttr);
                            }
                        }
                    }
                }
            } else if (corpusFiles[i].type === 'text/plain') {
                let txtString = await readTXT(corpusFiles[i]);
                function readTXT(file) {
                    return new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onload = function (e) {
                            const txtString = e.target.result;
                            resolve(txtString);
                        };
                        reader.readAsText(file);
                    });
                }
                let doc;
                if (lang === 'en') {
                    doc = nlp(txtString);
                } else if (lang === 'fr') {
                    doc = frCompromise(txtString);
                }
                if (typeChoice === 'lemmas') {
                    doc.compute('root');
                }
                doc = doc.json();
                for (let d of doc) {
                    let terms = d.terms;
                    for (let t of terms) {
                        let lemma = t.root || t.normal;
                        lemmas.add(lemma.toLowerCase());
                        const ttr = lemmas.size;
                        ttrValues.push(ttr);
                    }
                }
            }
        }
    }
    return ttrValues;
}

async function generateDataSet(corpora) {
    const dataSet = [];
    let labels = new Set();
    for (let c of corpora) {
        const corpusName = c.name;
        const lang = c.lang;
        const corpusFiles = c.files;
        const ttrValues = await computeTTRFromXml(
            corpusName,
            lang,
            corpusFiles
        );
        const data = [];
        const interval = intervalInput.value;
        ttrValues.forEach((ttr, index) => {
            if (index % interval === 0) {
                ttr = Number(ttr.toFixed(2));
                index = Number(index + 1);
                labels.add(index);
                data.push({ index, ttr });
            }
        });
        dataSet.push({
            label: corpusName,
            data: data,
            fill: false,
            parsing: { xAxisKey: 'index', yAxisKey: 'ttr' },
        });
    }
    labels = Array.from(labels).sort((a, b) => a - b);
    return [labels, dataSet];
}

const computeBtn = document.getElementById('compute-btn');
const dlGraphBtn = document.getElementById('dl-graph');
const dlDataBtn = document.getElementById('dl-data');
let graph;
computeBtn.addEventListener('click', async () => {
    if (corpora.length === 0) {
        return;
    }
    computeBtn.textContent = null;
    const spinner = document.createElement('span');
    spinner.classList.add('spinner');
    spinner.style.display = 'inline-block';
    computeBtn.appendChild(spinner);
    const result = await generateDataSet(corpora);
    const labels = result[0];
    let stepSize = 1000;
    if (labels[labels.length - 1] < 10000) {
        stepSize = 100;
    }
    const dataSet = result[1];
    counterSpan.textContent = null;
    counterSpan.style.display = 'none';
    let yText;
    if (typeChoice === 'types') {
        yText = 'Mots uniques';
    } else if (typeChoice === 'lemmas') {
        yText = 'Lemmes uniques';
    }
    const plugin = {
        id: 'customBgColor',
        beforeDraw: (chart, args, options) => {
            const { ctx } = chart;
            ctx.save();
            ctx.globalCompositeOperation = 'destination-over';
            ctx.fillStyle = options.color || 'white';
            ctx.fillRect(0, 0, chart.width, chart.height);
            ctx.restore();
        },
    };
    const ctx = document.getElementById('chart').getContext('2d');
    if (graph) {
        graph.options.scales.y.title.text = yText;
        graph.data.labels = labels;
        graph.data.datasets = dataSet;
        graph.update();
    } else {
        graph = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: dataSet,
            },
            options: {
                plugins: {
                    customColor: {
                        color: 'white',
                    },
                },
                elements: {
                    point: {
                        radius: 0,
                    },
                },
                scales: {
                    x: {
                        type: 'linear',
                        title: {
                            display: true,
                            text: 'Tokens',
                        },
                        ticks: {
                            stepSize: stepSize,
                            maxTicksLimit: 10,
                        },
                        beginAtZero: true,
                    },
                    y: {
                        title: {
                            display: true,
                            text: yText,
                        },
                    },
                },
            },
            plugins: [plugin],
        });
    }
    document.querySelector('div.chart-container').style.display = 'block';
    computeBtn.textContent = 'Créer le graphe';
    dlGraphBtn.style.display = 'inline-block';
    dlGraphBtn.addEventListener('click', () => {
        const link = document.createElement('a');
        link.href = graph.toBase64Image();
        link.download = 'graph.png';
        link.click();
    });
    dlDataBtn.style.display = 'inline-block';
    dlDataBtn.addEventListener('click', () => {
        const csvData = [];
        for (let ds of dataSet) {
            const label = ds.label;
            const data = ds.data;
            for (let d of data) {
                const index = d.index;
                const ttr = d.ttr;
                csvData.push({ corpus: label, index: index, lemmes: ttr });
            }
        }
        function convertToCsv(data) {
            const header = Object.keys(data[0]).join('\t');
            const rows = data.map((obj) => Object.values(obj).join('\t'));
            return [header, ...rows].join('\n');
        }
        const csvString = convertToCsv(csvData);
        var myBlob = new Blob([csvString], { type: 'text/csv' });
        var url = window.URL.createObjectURL(myBlob);
        var anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `data.csv`;
        anchor.click();
        window.URL.revokeObjectURL(url);
    });
    const resetBtn = document.getElementById('reset');
    resetBtn.style.display = 'inline-block';
    resetBtn.onclick = () => location.reload();
});

const dateSpan = document.getElementById('year');
const date = new Date();
const year = date.toISOString().split('-')[0];
dateSpan.textContent = year;
