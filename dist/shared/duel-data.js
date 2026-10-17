import raw from '../maps/duel-courtyard.json?v=68' with {type:'json'};
import {parseDuelMap} from './map-schema.js?v=68';
import {deepFreeze} from './schema.js?v=26';
export const DUEL_MAP=deepFreeze(parseDuelMap(raw));
