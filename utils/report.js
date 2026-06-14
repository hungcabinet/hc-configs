const entries = [];
let processedFiles = 0;
let skippedFiles = 0;

function reset() {
    entries.length = 0;
    processedFiles = 0;
    skippedFiles = 0;
}

function warn(scope, filePath, message) {
    entries.push({ level: 'warn', scope, filePath, message });
}

function error(scope, filePath, message) {
    entries.push({ level: 'error', scope, filePath, message });
}

function logValidation(scope, filePath, result) {
    for (const message of result.warnings || []) {
        warn(scope, filePath, message);
    }

    for (const message of result.errors || []) {
        error(scope, filePath, message);
    }
}

function recordProcessed() {
    processedFiles++;
}

function recordSkipped() {
    skippedFiles++;
}

function hasErrors() {
    return entries.some(entry => entry.level === 'error');
}

function printSummary() {
    const warnings = entries.filter(entry => entry.level === 'warn');
    const errors = entries.filter(entry => entry.level === 'error');

    console.log('');
    console.log('=== Отчёт генерации ===');
    console.log(`Обработано файлов: ${processedFiles}`);
    console.log(`Пропущено (ошибки парсинга): ${skippedFiles}`);
    console.log(`Предупреждений: ${warnings.length}`);
    console.log(`Ошибок: ${errors.length}`);

    if (warnings.length > 0) {
        console.log('');
        console.log('--- Предупреждения ---');
        for (const entry of warnings) {
            console.warn(`[WARN] [${entry.scope}] ${entry.filePath}: ${entry.message}`);
        }
    }

    if (errors.length > 0) {
        console.log('');
        console.log('--- Ошибки ---');
        for (const entry of errors) {
            console.error(`[ERR] [${entry.scope}] ${entry.filePath}: ${entry.message}`);
        }
    }

    if (errors.length === 0 && warnings.length === 0) {
        console.log('Замечаний нет.');
    }

    console.log('');
}

export default {
    reset,
    warn,
    error,
    logValidation,
    recordProcessed,
    recordSkipped,
    hasErrors,
    printSummary
};
