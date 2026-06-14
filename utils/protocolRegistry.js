import protocolHandlers from './protocolHandlers.js';
import sourceProfile from './sourceProfile.js';
import vlessParser from './parsers/vless.js';
import awgParser from './parsers/awg.js';
import naiveproxyParser from './parsers/naiveproxy.js';
import mieruParser from './parsers/mieru.js';

function fromParser(name, parser, generate) {
    return {
        name,
        pattern: parser.source.pattern,
        layout: parser.source.layout,
        extractUsers: parser.source.getUsers,
        getProfileId: (fileName) => sourceProfile.getProfileId(fileName, name),
        generate,
    };
}

const handlers = [
    fromParser('vless', vlessParser, protocolHandlers.generateVless),
    fromParser('awg', awgParser, protocolHandlers.generateAwg),
    fromParser('naiveproxy', naiveproxyParser, protocolHandlers.generateNaiveproxy),
    fromParser('mieru', mieruParser, protocolHandlers.generateMieru),
    {
        name: 'telegram',
        pattern: /^telegram.*\.link$/i,
        layout: 'per-user',
        getProfileId: (fileName) => sourceProfile.getProfileId(fileName, 'telegram'),
        generate: protocolHandlers.generateTelegram,
    },
];

function findHandler(fileName) {
    return handlers.find(handler => handler.pattern.test(fileName));
}

export default { handlers, findHandler };
