document.addEventListener('DOMContentLoaded', function() {
    // #############################################################
    // 1. Initialisierung und DOM-Elemente
    // #############################################################

    const dateInput = document.getElementById('dateInput');
    const auftragNrInput = document.getElementById('auftragNrInput');

    if (dateInput && dateInput.value === '') {
        const today = new Date();
        const dd = String(today.getDate()).padStart(2, '0');
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const yyyy = today.getFullYear();
        dateInput.value = `${dd}.${mm}.${yyyy}`;
    }

    const radioButtons = document.querySelectorAll('input[type="radio"]');
    radioButtons.forEach(radio => {
        radio.addEventListener('change', function() {
            console.log(`Radio-Button "${this.name}" geändert zu: ${this.value}`);

            const groupName = this.name;
            const radiosInGroup = document.querySelectorAll(`input[name="${groupName}"]`);

            radiosInGroup.forEach(r => {
                const parentLabel = r.closest('.radio-with-input');
                if (parentLabel) {
                    const textInput = parentLabel.querySelector('.radio-inline-input');
                    if (textInput) {
                        // Deaktiviere das Textfeld, wenn dieser spezifische Radio-Button nicht ausgewählt ist
                        // Aktiviere es, wenn er ausgewählt ist.
                        textInput.disabled = !r.checked;
                        if (!r.checked) {
                            textInput.value = '';
                        }
                    }
                }
            });
        });

        // Initialer Zustand beim Laden der Seite für Radio-Buttons mit Textfeld
        const parentLabel = radio.closest('.radio-with-input');
        if (parentLabel) {
            const textInput = parentLabel.querySelector('.radio-inline-input');
            if (textInput) {
                textInput.disabled = !radio.checked;
            }
        }
    });


    // #############################################################
    // 2. Zeichenfunktion für die Canvas mit Undo/Redo und Geraden
    // #############################################################

    const canvas = document.getElementById('drawingCanvas');
    const ctx = canvas.getContext('2d');

    const clearButton = document.getElementById('clearCanvas');
    const undoButton = document.getElementById('undo');
    const redoButton = document.getElementById('redo');
    const lineModeSelect = document.getElementById('lineMode');

    let isDrawing = false;
    let isStraightLineMode = false;
    let startPoint = { x: 0, y: 0 };
    let lastX = 0;
    let lastY = 0;

    let drawingHistory = [];
    let historyStep = -1;

    function saveDrawingState() {
        // Bereinige Redo-Historie, wenn ein neuer Schritt gemacht wird
        if (historyStep < drawingHistory.length - 1) {
            drawingHistory = drawingHistory.slice(0, historyStep + 1);
        }
        drawingHistory.push(canvas.toDataURL());
        historyStep = drawingHistory.length - 1;

        updateHistoryButtons();
    }

    function restoreDrawingState() {
        if (historyStep >= 0 && drawingHistory[historyStep]) {
            const img = new Image();
            img.onload = function() {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            };
            img.src = drawingHistory[historyStep];
        } else {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        updateHistoryButtons();
    }

    function updateHistoryButtons() {
        undoButton.disabled = historyStep <= 0;
        redoButton.disabled = historyStep >= drawingHistory.length - 1;
    }

    function resizeCanvas() {
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        tempCtx.drawImage(canvas, 0, 0);

        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;

        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height);

        // Nach dem Resize den aktuellen Zustand neu speichern, wenn der Canvas Inhalt hat
        // Dies stellt sicher, dass Undo/Redo auch nach einer Größenänderung funktioniert.
        if (drawingHistory.length > 0) { // Prüfen, ob es überhaupt eine Historie gibt
            // Nur den letzten Zustand aktualisieren, wenn wir am Ende der Historie sind.
            // Sonst könnte ein Resize einen "Redo"-Pfad abschneiden.
            if (historyStep === drawingHistory.length - 1) {
                drawingHistory[historyStep] = canvas.toDataURL(); // Aktuellen Zustand überschreiben
            } else {
                saveDrawingState(); // Oder neuen Schritt hinzufügen, wenn es keine Redo-Option gäbe
            }
        } else {
            saveDrawingState(); // Initialen leeren Zustand speichern, falls noch nichts da ist
        }
    }

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    clearButton.addEventListener('click', function() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawingHistory = [];
        historyStep = -1;
        saveDrawingState();
    });

    undoButton.addEventListener('click', function() {
        if (historyStep > 0) {
            historyStep--;
            restoreDrawingState();
        }
    });

    redoButton.addEventListener('click', function() {
        if (historyStep < drawingHistory.length - 1) {
            historyStep++;
            restoreDrawingState();
        }
    });

    lineModeSelect.addEventListener('change', function() {
        isStraightLineMode = (this.value === 'straight');
    });

    function getCoordinates(e) {
        // e.offsetX und e.offsetY sind in der Regel die besten für Canvas
        // Sie geben Koordinaten relativ zum Element an.
        if (e.touches && e.touches.length > 0) {
            const rect = canvas.getBoundingClientRect();
            const touch = e.touches[0];
            return [touch.clientX - rect.left, touch.clientY - rect.top];
        } else {
            return [e.offsetX, e.offsetY];
        }
    }

    function startDrawing(e) {
        isDrawing = true;
        // Speichere den Zustand VOR Beginn dieser neuen Linie
        saveDrawingState();

        [lastX, lastY] = getCoordinates(e);
        startPoint = { x: lastX, y: lastY };

        // Bei Freihand sofort den Pfad beginnen
        if (!isStraightLineMode) {
            ctx.beginPath();
            ctx.moveTo(lastX, lastY);
        }
    }

    function draw(e) {
        if (!isDrawing) return;
        e.preventDefault();

        const [currentX, currentY] = getCoordinates(e);

        if (isStraightLineMode) {
            // Für gerade Linien: Immer den letzten GESPEICHERTEN Zustand wiederherstellen
            // und dann die aktuelle Vorschau-Linie darüber zeichnen.
            if (historyStep >= 0 && drawingHistory[historyStep]) {
                const img = new Image();
                img.onload = function() {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height); // Hintergrund wiederherstellen

                    // Zeichne die aktuelle Vorschau-Linie
                    ctx.beginPath();
                    ctx.moveTo(startPoint.x, startPoint.y);
                    ctx.lineTo(currentX, currentY);
                    ctx.stroke();
                };
                img.src = drawingHistory[historyStep];
            } else { // Wenn keine Historie, einfach auf leerem Canvas zeichnen (sollte nie passieren, aber zur Sicherheit)
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.beginPath();
                ctx.moveTo(startPoint.x, startPoint.y);
                ctx.lineTo(currentX, currentY);
                ctx.stroke();
            }
            [lastX, lastY] = [currentX, currentY]; // Aktualisiere lastX/Y für stopDrawing
        } else {
            // Freihand: Füge neue Segmente zum aktuellen Pfad hinzu
            ctx.lineTo(currentX, currentY);
            ctx.stroke(); // Jedes Segment sofort zeichnen
            [lastX, lastY] = [currentX, currentY];
        }
    }

    function stopDrawing() {
        if (!isDrawing) return;
        isDrawing = false;

        // Wenn im Geraden-Modus, die finale Linie zeichnen.
        // Der Zustand wurde bereits in startDrawing() gespeichert.
        // Hier ist keine zusätzliche saveDrawingState() nötig, wenn startDrawing es schon tut.
        // Die Vorschau-Logik in 'draw' hat schon den Hintergrund gehandhabt.
        // Die letzte draw()-Iteration hat bereits die finale Linie in der Vorschau gezeigt.
        // Es muss nur sichergestellt werden, dass dieser Zustand bestehen bleibt.
        // Da 'saveDrawingState' zu Beginn von 'startDrawing' aufgerufen wird,
        // enthält der letzte Historien-Schritt den Zustand VOR der aktuellen Linie.
        // Wir müssen hier nichts weiter tun, als sicherzustellen, dass die letzte gezeichnete Linie
        // (die ja als Vorschau schon da war) bestehen bleibt.
        // Das passiert implizit, da wir nicht clearen und nicht wiederherstellen,
        // außer im "draw"-Zyklus.
        // Wenn man die finale Linie nach dem Maus-Up nochmal explizit zeichnen möchte,
        // müsste man den letzten Historien-Zustand wiederherstellen und dann die finale Linie zeichnen
        // (ähnlich wie in `draw` für straight, aber nur einmal).
        // ABER: Die aktuelle Implementierung von saveDrawingState() am Anfang von startDrawing()
        // bedeutet, dass der Hintergrund für die nächste Linie schon korrekt ist.
        // Die finale Linie im Geradenmodus wird schon im letzten `draw` Schritt gezeichnet.
        // Daher ist hier keine explizite Zeichenaktion mehr nötig.
        // Dies vereinfacht die Logik und vermeidet Doppelungen.

        // Für Freihand-Linien: Der Pfad ist bereits abgeschlossen und gezeichnet.
        // Der Zustand wurde schon am Anfang der Bewegung gespeichert.
        // Hier muss nichts weiter getan werden.
    }

    // Event Listener für Maus-Events
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);

    // Event Listener für Touch-Events
    canvas.addEventListener('touchstart', startDrawing, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', stopDrawing);
    canvas.addEventListener('touchcancel', stopDrawing);

    // Initialen leeren Zustand in die Historie aufnehmen
    setTimeout(() => {
        if (drawingHistory.length === 0) { // Nur speichern, wenn die Historie noch leer ist
             saveDrawingState();
        }
    }, 100);
});