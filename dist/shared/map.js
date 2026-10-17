// Loads the bundled arena map once, validates it, and exposes one frozen copy with its queries.
import emberfall from '../maps/emberfall.json?v=60' with {type:'json'};
import {parseMap,MAP_SCHEMA_VERSION} from './map-schema.js?v=60';
import {createMapQueries} from './map-queries.js?v=45';
import {deepFreeze,contentHash} from './schema.js?v=26';

// The map editor saves drafts here; index.html?draft plays the saved draft instead of the bundled map.
export const DRAFT_KEY='emberfall.mapDraft';
function savedDraft(){try{return typeof location!=='undefined'&&new URLSearchParams(location.search).has('draft')?JSON.parse(localStorage.getItem(DRAFT_KEY)):null;}catch{return null;}}
const draft=savedDraft(),source=draft??emberfall;
export const MAP_SOURCE=draft?'draft':'bundled';
export const MAP=deepFreeze(parseMap(source,draft?'draft.json':'emberfall.json'));
// Identifies the exact map content so a future server and its clients can confirm they match.
export const MAP_VERSION=`${MAP_SCHEMA_VERSION}-${contentHash(JSON.stringify(source))}`;
export const {lavaDistance,isLava,groundHeight,safeZone,isUnderBridge}=createMapQueries(MAP);
