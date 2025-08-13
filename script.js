document.addEventListener('DOMContentLoaded', () => {

    // ---- Allgemeine Formularfunktionen ----
    const dateInput = document.getElementById('dateInput');
    if (dateInput) {
        // OPTIMIERT: Direkte Verwendung von toLocaleDateString für einfaches Datumsformat
        dateInput.value = new Date().toLocaleDateString('de-DE');
    }

    // Radio-Buttons mit integriertem Textfeld
    document.querySelectorAll('.radio-with-input').forEach(container => {
        const radio = container.querySelector('input[type="radio"]');
        const textInput = container.querySelector('input[type="text"]');
        if (radio && textInput) {
            textInput.disabled = !radio.checked;

            // Finde alle Radios mit demselben Namen, um das Deaktivieren zu steuern
            const groupName = radio.name;
            document.querySelectorAll(`input[type="radio"][name="${groupName}"]`).forEach(otherRadio => {
                otherRadio.addEventListener('change', () => {
                    textInput.disabled = !radio.checked;
                    if (!radio.checked) {
                        textInput.value = '';
                    }
                });
            });
        }
    });


    // ---- Zeichenbereich-Funktionen ----
    const canvas = document.getElementById('drawingCanvas');
    if (!canvas) {
        console.error("Canvas-Element mit der ID 'drawingCanvas' wurde nicht gefunden.");
        return;
    }
    const ctx = canvas.getContext('2d');
    const container = canvas.parentElement;

    // Steuerelemente
    const controls = {
        clear: document.getElementById('clearCanvas'),
        undo: document.getElementById('undo'),
        redo: document.getElementById('redo'),
        lineMode: document.getElementById('lineMode'),
        erase: document.getElementById('eraseMode'),
        text: document.getElementById('addText'),
        anbohrung: document.getElementById('addAnbohrungX'),
        schutzrohr: document.getElementById('addSchutzrohrRect'),
        exportPdf: document.getElementById('exportPdf')
    };

    // Zeichenzustand
    let isDrawing = false;
    let currentTool = 'free';
    let startPos = { x: 0, y: 0 };
    
    // OPTIMIERT: Vereinfachte Undo/Redo-Logik. Speichert nur noch Bilddaten.
    let undoStack = [];
    let redoStack = [];

    // --- Canvas Initialisierung und Größenanpassung ---
    function resizeCanvas() {
        const tempImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
        ctx.putImageData(tempImageData, 0, 0);
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // --- Undo / Redo Logik ---
    function saveState() {
        undoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
        redoStack = []; // Eine neue Aktion löscht den Redo-Stack
        updateUndoRedoButtons();
    }

    function undo() {
        if (undoStack.length > 1) { // Der erste Zustand ist die leere Leinwand
            redoStack.push(undoStack.pop());
            ctx.putImageData(undoStack[undoStack.length - 1], 0, 0);
            updateUndoRedoButtons();
        }
    }
    
    function redo() {
        if (redoStack.length > 0) {
            const state = redoStack.pop();
            undoStack.push(state);
            ctx.putImageData(state, 0, 0);
            updateUndoRedoButtons();
        }
    }

    function updateUndoRedoButtons() {
        controls.undo.disabled = undoStack.length <= 1;
        controls.redo.disabled = redoStack.length === 0;
    }
    
    // Initialen Zustand speichern
    saveState();


    // --- Werkzeug-Logik ---
    // NEU: Zentrale Funktion zur Werkzeugauswahl
    function setTool(tool) {
        currentTool = tool;

        // Alle Highlights entfernen
        document.querySelectorAll('.active-tool').forEach(el => el.classList.remove('active-tool'));
        
        // Canvas-Eigenschaften zurücksetzen
        ctx.globalCompositeOperation = 'source-over';
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'black';
        canvas.style.cursor = 'crosshair';

        // Werkzeugspezifische Einstellungen
        switch(tool) {
            case 'erase':
                ctx.globalCompositeOperation = 'destination-out';
                ctx.lineWidth = 15;
                controls.erase.classList.add('active-tool');
                break;
            case 'text':
                canvas.style.cursor = 'text';
                controls.text.classList.add('active-tool');
                break;
            case 'anbohrungX':
            case 'schutzrohrRect':
                canvas.style.cursor = 'pointer';
                if(tool === 'anbohrungX') controls.anbohrung.classList.add('active-tool');
                if(tool === 'schutzrohrRect') controls.schutzrohr.classList.add('active-tool');
                break;
        }
    }

    // --- Event Listener ---
    // OPTIMIERT: Verwendung von Pointer Events für Maus und Touch
    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerup', handlePointerUp);
    canvas.addEventListener('pointerleave', handlePointerUp); // Beendet das Zeichnen, wenn der Pointer den Canvas verlässt

    controls.clear.addEventListener('click', () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        saveState();
    });
    controls.undo.addEventListener('click', undo);
    controls.redo.addEventListener('click', redo);
    
    // Werkzeug-Buttons
    controls.lineMode.addEventListener('change', (e) => setTool(e.target.value));
    controls.erase.addEventListener('click', () => setTool('erase'));
    controls.text.addEventListener('click', () => setTool('text'));
    controls.anbohrung.addEventListener('click', () => setTool('anbohrungX'));
    controls.schutzrohr.addEventListener('click', () => setTool('schutzrohrRect'));
    controls.exportPdf.addEventListener('click', exportToPdf);

    // --- Pointer Handler ---
    // ... (bestehender Code oben)

    // --- Pointer Handler ---
    function getPointerPos(e) {
        const rect = canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

// ... (bestehender Code unten)

    function handlePointerDown(e) {
        isDrawing = true;
        startPos = getPointerPos(e);
        
        // Ein-Klick-Werkzeuge
        if (currentTool === 'text') {
            isDrawing = false; // Verhindert das Ziehen
            addTextInput(startPos.x, startPos.y);
            return;
        }
        if (currentTool === 'anbohrungX') {
            isDrawing = false;
            drawAnbohrungX(startPos.x, startPos.y);
            saveState();
            return;
        }

        // Zustand für das Ziehen (Linien, Radierer) speichern
        ctx.beginPath();
        ctx.moveTo(startPos.x, startPos.y);
    }
    
    function handlePointerMove(e) {
        if (!isDrawing) return;
        const currentPos = getPointerPos(e);
        
        switch (currentTool) {
            case 'free':
            case 'erase':
                ctx.lineTo(currentPos.x, currentPos.y);
                ctx.stroke();
                break;
            case 'straight':
            case 'dashed':
            case 'schutzrohrRect':
                // Temporäres Zeichnen: Letzten Zustand wiederherstellen und Vorschau zeichnen
                ctx.putImageData(undoStack[undoStack.length - 1], 0, 0);
                ctx.beginPath();
                if (currentTool === 'dashed') ctx.setLineDash([5, 5]);
                
                if (currentTool === 'schutzrohrRect') {
                    ctx.rect(startPos.x, startPos.y, currentPos.x - startPos.x, currentPos.y - startPos.y);
                } else {
                    ctx.moveTo(startPos.x, startPos.y);
                    ctx.lineTo(currentPos.x, currentPos.y);
                }
                ctx.stroke();
                ctx.setLineDash([]); // Strichmuster immer zurücksetzen
                break;
        }
    }

    function handlePointerUp(e) {
        if (!isDrawing) return;
        isDrawing = false;
        
        // Finales Zeichnen für Werkzeuge mit Vorschau
        if (['straight', 'dashed', 'schutzrohrRect'].includes(currentTool)) {
           saveState(); // Der letzte gezeichnete Zustand aus handlePointerMove wird jetzt gespeichert
        } else {
            // Für Freihand und Radierer wird der Zustand nach dem Zeichnen gespeichert
            saveState();
        }
    }

    // --- Spezifische Zeichenfunktionen ---
    // NEU: Interaktive Texteingabe
    function addTextInput(x, y) {
        const input = document.createElement('input');
        input.type = 'text';
        input.style.position = 'absolute';
        input.style.left = `${x + canvas.offsetLeft}px`;
        input.style.top = `${y + canvas.offsetTop}px`;
        input.style.border = '1px solid #007bff';
        input.style.font = '16px Arial';
        input.style.zIndex = 100;
        document.body.appendChild(input);
        input.focus();

        function finalizeText() {
            if (input.value) {
                ctx.font = '16px Arial';
                ctx.fillStyle = 'black';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'top';
                ctx.fillText(input.value, x, y);
                saveState();
            }
            document.body.removeChild(input);
            setTool(controls.lineMode.value); // Zurück zum Linienmodus
        }
        
        input.addEventListener('blur', finalizeText);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                input.blur(); // Triggert das 'blur'-Event zum Speichern
            }
        });
    }

    function drawAnbohrungX(x, y) {
        const size = 10;
        ctx.beginPath();
        ctx.moveTo(x - size, y - size);
        ctx.lineTo(x + size, y + size);
        ctx.moveTo(x + size, y - size);
        ctx.lineTo(x - size, y + size);
        ctx.stroke();
    }
    
    // ---- PDF Export Funktion ----
    async function exportToPdf() {
        controls.exportPdf.disabled = true;
        controls.exportPdf.textContent = 'PDF wird erstellt...';

        // NEU: Overlay hinzufügen für besseres Nutzerfeedback
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.top = 0;
        overlay.style.left = 0;
        overlay.style.width = '100vw';
        overlay.style.height = '100vh';
        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        overlay.style.color = 'white';
        overlay.style.display = 'flex';
        overlay.style.justifyContent = 'center';
        overlay.style.alignItems = 'center';
        overlay.style.fontSize = '2em';
        overlay.style.zIndex = 1000;
        overlay.textContent = 'PDF wird generiert...';
        document.body.appendChild(overlay);

        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 10;
        let yPos = margin;
        
        // Alle Sektionen sammeln
        const sections = document.querySelectorAll('#header-section, #info-header-section, #main-form-section, #drawing-area-section, #footer-info-section');
        
        // Zeichen-Controls vor dem Screenshot ausblenden
        const drawingControls = document.querySelector('.drawing-controls');
        if (drawingControls) drawingControls.style.visibility = 'hidden';

        for (const section of sections) {
            const canvas = await html2canvas(section, { scale: 2, backgroundColor: '#ffffff' });
            const imgData = canvas.toDataURL('image/jpeg', 0.9);
            const imgHeight = canvas.height * (pdfWidth - margin * 2) / canvas.width;

            if (yPos + imgHeight > pageHeight - margin) {
                pdf.addPage();
                yPos = margin;
            }

            pdf.addImage(imgData, 'JPEG', margin, yPos, pdfWidth - margin * 2, imgHeight);
            yPos += imgHeight + 5; // Kleiner Abstand zwischen den Sektionen
        }
        
        // Zeichen-Controls wieder einblenden
        if (drawingControls) drawingControls.style.visibility = 'visible';
        
        // Dateiname
        const auftragNr = document.getElementById('auftragNrInput').value || 'Unbekannt';
        const filename = `Hausanschlussriss_${auftragNr.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
        pdf.save(filename);
        
        document.body.removeChild(overlay); // Overlay entfernen
        controls.exportPdf.disabled = false;
        controls.exportPdf.textContent = 'Als PDF exportieren';
    }
});

