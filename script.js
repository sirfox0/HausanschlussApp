document.addEventListener('DOMContentLoaded', () => {
    // ---- Allgemeine Formularfunktionen ----
    const dateInput = document.getElementById('dateInput');
    if (dateInput) {
        const today = new Date();
        const dd = String(today.getDate()).padStart(2, '0');
        const mm = String(today.getMonth() + 1).padStart(2, '0'); // Januar ist 0!
        const yyyy = today.getFullYear();
        dateInput.value = `${dd}.${mm}.${yyyy}`;
    }

    // Logik für Radio-Buttons mit integriertem Textfeld
    document.querySelectorAll('.radio-with-input input[type="radio"]').forEach(radio => {
        const input = radio.nextElementSibling; // Das Input-Feld ist direkt nach dem Radio-Button
        if (input && input.classList.contains('radio-inline-input')) {
            // Beim Laden der Seite: Wenn dieser Radio-Button nicht gecheckt ist, Input deaktivieren
            input.disabled = !radio.checked;

            // Event-Listener für Änderungen am Radio-Button
            radio.addEventListener('change', () => {
                // Wenn dieser Radio-Button gewählt wird, Input aktivieren, sonst deaktivieren
                input.disabled = !radio.checked;
                // Optional: Input leeren, wenn Radio-Button abgewählt wird
                if (input.disabled) {
                    input.value = '';
                }
            });
        }
    });

    // ---- Zeichenbereich-Funktionen ----
    const canvas = document.getElementById('drawingCanvas');
    // Stellen Sie sicher, dass Canvas existiert, bevor Sie getContext aufrufen
    if (!canvas) {
        console.error("Canvas-Element mit der ID 'drawingCanvas' wurde nicht gefunden.");
        return; // Skript beenden, wenn Canvas nicht gefunden wird
    }
    const ctx = canvas.getContext('2d');
    const clearButton = document.getElementById('clearCanvas');
    const undoButton = document.getElementById('undo');
    const redoButton = document.getElementById('redo');
    const lineModeSelect = document.getElementById('lineMode');
    const eraseModeButton = document.getElementById('eraseMode');
    const addTextButton = document.getElementById('addText');
    const addAnbohrungXButton = document.getElementById('addAnbohrungX');
    const addSchutzrohrRectButton = document.getElementById('addSchutzrohrRect');
    const exportPdfButton = document.getElementById('exportPdf');

    // NEU: Referenzen zu den einzelnen Sektionen (Stellen Sie sicher, dass diese IDs auch in Ihrer index.html existieren!)
    const headerSection = document.getElementById('header-section');
    const infoHeaderSection = document.getElementById('info-header-section');
    const mainFormSection = document.getElementById('main-form-section');
    const drawingAreaSection = document.getElementById('drawing-area-section');
    const footerInfoSection = document.getElementById('footer-info-section');


    let drawing = false;
    let currentMode = 'free';
    let startX = 0;
    let startY = 0;
    let lastX = 0;
    let lastY = 0;

    let undoStack = [];
    let redoStack = [];
    let historyIndex = -1;
    let textFields = [];

    // Setzt die Canvas-Größe basierend auf dem CSS-Stil
    function resizeCanvas() {
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
        redrawAll(); // Nach Größenänderung alles neu zeichnen
    }

    // Initiales Resize und Listener für Größenänderungen des Fensters
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Initialer Zustand auf dem Canvas speichern
    function saveCanvasState() {
        // Entferne alle zukünftigen Zustände, wenn eine neue Aktion ausgeführt wird
        undoStack = undoStack.slice(0, historyIndex + 1);
        redoStack = []; // Redo-Stack leeren

        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        undoStack.push({ imageData: imgData, textFields: JSON.parse(JSON.stringify(textFields)) });
        historyIndex = undoStack.length - 1;
        updateUndoRedoButtons();
    }

    function restoreCanvasState(index) {
        if (index < 0 || index >= undoStack.length) return;

        const state = undoStack[index];
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.putImageData(state.imageData, 0, 0);

        textFields = JSON.parse(JSON.stringify(state.textFields));
        renderTextFields();
        updateUndoRedoButtons();
    }

    function updateUndoRedoButtons() {
        undoButton.disabled = historyIndex <= 0;
        redoButton.disabled = historyIndex >= undoStack.length - 1;
    }

    function redrawAll() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (undoStack.length > 0 && undoStack[historyIndex]) {
            ctx.putImageData(undoStack[historyIndex].imageData, 0, 0);
        }
        renderTextFields();
    }

    // Beim Start einmal den leeren Zustand speichern
    saveCanvasState();

    // ---- Event Listener für Zeichenfläche ----
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);
    canvas.addEventListener('mousemove', draw);

    // Touch-Events für Mobilgeräte
    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        startDrawing({ offsetX: touch.clientX - canvas.getBoundingClientRect().left, offsetY: touch.clientY - canvas.getBoundingClientRect().top });
    });
    canvas.addEventListener('touchend', stopDrawing);
    canvas.addEventListener('touchcancel', stopDrawing);
    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        draw({ offsetX: touch.clientX - canvas.getBoundingClientRect().left, offsetY: touch.clientY - canvas.getBoundingClientRect().top });
    });

    // Event Listener für Buttons
    clearButton.addEventListener('click', () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        textFields = [];
        saveCanvasState();
        renderTextFields();
    });

    undoButton.addEventListener('click', () => {
        if (historyIndex > 0) {
            historyIndex--;
            restoreCanvasState(historyIndex);
        }
    });

    redoButton.addEventListener('click', () => {
        if (historyIndex < undoStack.length - 1) {
            historyIndex++;
            restoreCanvasState(historyIndex);
        }
    });

    // Hilfsfunktion zum Zurücksetzen der aktiven Werkzeug-Highlights
    function resetToolHighlights() {
        eraseModeButton.classList.remove('active-tool');
        addTextButton.classList.remove('active-tool');
        addAnbohrungXButton.classList.remove('active-tool');
        addSchutzrohrRectButton.classList.remove('active-tool');
    }

    lineModeSelect.addEventListener('change', (e) => {
        currentMode = e.target.value;
        resetToolHighlights(); // Radiergummi, Text, Formen abwählen
        ctx.globalCompositeOperation = 'source-over'; // Wichtig: Für normale Linien zurücksetzen
        ctx.lineWidth = 2; // Linienbreite für normale Modi setzen
    });

    eraseModeButton.addEventListener('click', () => {
        currentMode = 'erase';
        resetToolHighlights();
        eraseModeButton.classList.add('active-tool');
        // lineModeSelect.value = 'free'; // <-- Diese Zeile entfernt
        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineWidth = 15;
    });

    addTextButton.addEventListener('click', () => {
        currentMode = 'text';
        resetToolHighlights();
        addTextButton.classList.add('active-tool');
        // lineModeSelect.value = 'free'; // <-- Diese Zeile entfernt
        ctx.globalCompositeOperation = 'source-over';
        alert('Klicke auf die Zeichenfläche, um ein Textfeld hinzuzufügen.');
    });

    addAnbohrungXButton.addEventListener('click', () => {
        currentMode = 'anbohrungX';
        resetToolHighlights();
        addAnbohrungXButton.classList.add('active-tool');
        // lineModeSelect.value = 'free'; // <-- Diese Zeile entfernt
        ctx.globalCompositeOperation = 'source-over';
        alert('Klicke auf die Zeichenfläche, um das Anbohrung X zu platzieren.');
    });

    addSchutzrohrRectButton.addEventListener('click', () => {
        currentMode = 'schutzrohrRect';
        resetToolHighlights();
        addSchutzrohrRectButton.classList.add('active-tool');
        // lineModeSelect.value = 'free'; // <-- Diese Zeile entfernt
        ctx.globalCompositeOperation = 'source-over';
        alert('Klicke und ziehe auf der Zeichenfläche, um ein Schutzrohr-Rechteck zu zeichnen.');
    });

    // NEU: Event Listener für den PDF-Export Button
    exportPdfButton.addEventListener('click', exportToPdf);

    // ---- Zeichenlogik ----
    function startDrawing(e) {
        if (currentMode === 'text') {
            addTextField(e.offsetX, e.offsetY);
            return;
        }
        if (currentMode === 'anbohrungX') {
            drawAnbohrungX(e.offsetX, e.offsetY);
            saveCanvasState();
            currentMode = 'free'; // Sollte nach dem Platzieren zum Standard zurückkehren
            addAnbohrungXButton.classList.remove('active-tool');
            return;
        }

        drawing = true;
        startX = e.offsetX; // Startpunkt für dynamisches Zeichnen
        startY = e.offsetY; // Startpunkt für dynamisches Zeichnen
        lastX = e.offsetX; // Für Freihand/Radiergummi
        lastY = e.offsetY; // Für Freihand/Radiergummi

        // Zustand nur speichern, wenn es eine Zeichenaktion ist, die den Canvas dauerhaft verändert
        // Bei 'straight', 'dashed', und jetzt auch 'schutzrohrRect' zeichnen wir temporär und speichern am Ende
        if (currentMode === 'free' || currentMode === 'erase') {
             saveCanvasState();
        }
    }

    function draw(e) {
        if (!drawing) return;

        if (currentMode !== 'erase') {
            ctx.lineWidth = 2;
            ctx.strokeStyle = 'black';
        }
        ctx.lineCap = 'round';

        if (currentMode === 'free' || currentMode === 'erase') {
            ctx.beginPath();
            ctx.moveTo(lastX, lastY);
            ctx.lineTo(e.offsetX, e.offsetY);
            ctx.stroke();
            [lastX, lastY] = [e.offsetX, e.offsetY];
        } else if (currentMode === 'straight' || currentMode === 'dashed' || currentMode === 'schutzrohrRect') {
            restoreCanvasState(historyIndex); // Letzten "echten" Zustand laden

            ctx.beginPath();
            if (currentMode === 'straight') {
                ctx.moveTo(startX, startY);
                ctx.lineTo(e.offsetX, e.offsetY);
            } else if (currentMode === 'dashed') {
                ctx.setLineDash([5, 5]);
                ctx.moveTo(startX, startY);
                ctx.lineTo(e.offsetX, e.offsetY);
            } else if (currentMode === 'schutzrohrRect') { // Temporäres Rechteck zeichnen
                const rectX = Math.min(startX, e.offsetX);
                const rectY = Math.min(startY, e.offsetY);
                const width = Math.abs(e.offsetX - startX);
                const height = Math.abs(e.offsetY - startY);
                ctx.rect(rectX, rectY, width, height);
            }
            ctx.stroke();
            ctx.setLineDash([]); // WICHTIG: Strichmuster zurücksetzen
        }
    }

    function stopDrawing() {
        if (!drawing) return;
        drawing = false;

        // Finales Zeichnen und Speichern des Zustands
        if (currentMode === 'straight' || currentMode === 'dashed' || currentMode === 'schutzrohrRect') {
            ctx.beginPath();
            ctx.lineWidth = 2;
            ctx.strokeStyle = 'black';

            if (currentMode === 'straight') {
                ctx.moveTo(startX, startY);
                ctx.lineTo(lastX, lastY); // Verwende lastX/Y vom letzten Mousemove
            } else if (currentMode === 'dashed') {
                ctx.setLineDash([5, 5]);
                ctx.moveTo(startX, startY);
                ctx.lineTo(lastX, lastY);
            } else if (currentMode === 'schutzrohrRect') { // Finales Rechteck zeichnen
                const rectX = Math.min(startX, lastX);
                const rectY = Math.min(startY, lastY);
                const width = Math.abs(lastX - startX);
                const height = Math.abs(lastY - startY);
                ctx.rect(rectX, rectY, width, height);
            }
            ctx.stroke();
            ctx.setLineDash([]);

            saveCanvasState(); // Nach dem finalen Zeichnen speichern

            // Der currentMode soll HIER NICHT zurückgesetzt werden, um die Auswahl zu behalten.
            // Die folgenden Zeilen wurden entfernt:
            // currentMode = 'free';
            // resetToolHighlights();
        }

        // Modus zurücksetzen
        if (currentMode === 'erase') {
            currentMode = 'free'; // Radiergummi soll nach Nutzung zum Freihand-Modus zurückkehren
            eraseModeButton.classList.remove('active-tool');
            ctx.globalCompositeOperation = 'source-over';
            ctx.lineWidth = 2; // Linienbreite zurücksetzen
        }
        // Der 'else if' Block für 'straight', 'dashed', 'schutzrohrRect' wurde hier entfernt,
        // da deren Modus beibehalten werden soll.
    }

    // ---- Funktionen für Textfelder ----
    function addTextField(x, y) {
        const textValue = prompt('Bitte Text eingeben:');
        if (textValue) {
            const fontSize = 16;
            const fontFamily = 'Arial';
            const textColor = 'black';

            textFields.push({
                x: x,
                y: y,
                text: textValue,
                fontSize: fontSize,
                fontFamily: fontFamily,
                color: textColor
            });
            renderTextFields();
            saveCanvasState();
        }
        currentMode = 'free'; // Nach dem Hinzufügen eines Textfeldes zum Freihand-Modus zurückkehren
        addTextButton.classList.remove('active-tool');
    }

    function renderTextFields() {
        if (undoStack.length > 0 && undoStack[historyIndex]) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.putImageData(undoStack[historyIndex].imageData, 0, 0);
        } else {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }

        textFields.forEach(field => {
            ctx.font = `${field.fontSize}px ${field.fontFamily}`;
            ctx.fillStyle = field.color;
            ctx.fillText(field.text, field.x, field.y);
        });
    }

    // ---- Funktionen für vordefinierte Formen (einmalig platzierbar) ----
    function drawAnbohrungX(x, y) {
        const size = 15;
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.moveTo(x - size / 2, y - size / 2);
        ctx.lineTo(x + size / 2, y + size / 2);
        ctx.moveTo(x + size / 2, y - size / 2);
        ctx.lineTo(x - size / 2, y + size / 2);
        ctx.stroke();
    }

    // ---- PDF Export Funktion ----
    async function exportToPdf() {
        exportPdfButton.disabled = true;
        exportPdfButton.textContent = 'PDF wird erstellt...';

        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4'); // A4-Format

        const imgWidth = 210; // Breite des A4-Formats in mm
        const pageHeight = 297; // Höhe des A4-Formats in mm
        const padding = 10; // Rand auf jeder Seite in mm

        // Hilfsfunktion zum Hinzufügen von gerenderten Elementen
        async function addSectionToPdf(element, pdfInstance, currentY) {
            // Temporär alle drawing-controls buttons/select ausblenden, damit sie nicht im Screenshot sind
            const drawingControls = document.querySelector('.drawing-controls');
            if (drawingControls) {
                drawingControls.style.visibility = 'hidden';
            }

            const canvasImage = await html2canvas(element, {
                scale: 2, // Hier kannst du mit 1, 1.5, 2 experimentieren für Dateigröße vs. Qualität
                useCORS: true,
                allowTaint: true,
                backgroundColor: '#ffffff' // Wichtig, um transparente Bereiche weiß zu füllen
            });

            if (drawingControls) {
                drawingControls.style.visibility = 'visible'; // Wieder einblenden
            }

            const imgData = canvasImage.toDataURL('image/jpeg', 0.9); // JPEG mit Qualität 0.9 für kleinere Dateigröße
            const imgHeight = canvasImage.height * (imgWidth - 2 * padding) / canvasImage.width; // Höhe des Bildes im Verhältnis zur verfügbaren Breite

            // Prüfen, ob eine neue Seite benötigt wird
            if (currentY + imgHeight > pageHeight - padding && currentY !== padding) {
                pdfInstance.addPage();
                currentY = padding; // Neuer Startpunkt auf der neuen Seite
            }

            pdfInstance.addImage(imgData, 'JPEG', padding, currentY, imgWidth - 2 * padding, imgHeight);
            return currentY + imgHeight + padding; // Neuer Y-Startpunkt für das nächste Element
        }

        let currentY = padding; // Start Y-Koordinate mit Rand

        try {
            // Header
            if (headerSection) currentY = await addSectionToPdf(headerSection, pdf, currentY);

            // Info Header
            if (infoHeaderSection) currentY = await addSectionToPdf(infoHeaderSection, pdf, currentY);

            // Hauptformular
            if (mainFormSection) currentY = await addSectionToPdf(mainFormSection, pdf, currentY);

            // Zeichenfläche auf EIGENE SEITE
            if (drawingAreaSection) {
                pdf.addPage(); // Immer eine neue Seite für die Zeichenfläche
                currentY = padding; // Y-Startpunkt zurücksetzen
                currentY = await addSectionToPdf(drawingAreaSection, pdf, currentY);
            }

            // Fußzeile
            if (footerInfoSection) {
                 // Prüfen, ob die Fußzeile noch auf die aktuelle Seite passt, sonst neue Seite
                // Dies ist eine ungefähre Berechnung, da das gerenderte Bild erst erzeugt wird
                // Eine genauere Berechnung wäre aufwändig.
                if (currentY + footerInfoSection.offsetHeight * (imgWidth - 2 * padding) / footerInfoSection.offsetWidth > pageHeight - padding && currentY !== padding) {
                    pdf.addPage();
                    currentY = padding;
                }
                currentY = await addSectionToPdf(footerInfoSection, pdf, currentY);
            }


            // Dateiname generieren
            const auftragNr = document.getElementById('auftragNrInput').value || 'Unbekannt';
            const date = document.getElementById('dateInput').value || 'Datum';
            const filename = `Hausanschlussriss_${auftragNr.replace(/[^a-zA-Z0-9]/g, '_')}_${date.replace(/\./g, '-')}.pdf`;

            pdf.save(filename);

        } catch (error) {
            console.error('Fehler beim Export des PDFs:', error);
            alert('Es gab einen Fehler beim Exportieren des PDFs. Bitte versuchen Sie es erneut.');
        } finally {
            // Sicherstellen, dass der Button wieder aktiviert wird, auch bei Fehlern
            exportPdfButton.disabled = false;
            exportPdfButton.textContent = 'Als PDF exportieren';
        }
    }
});