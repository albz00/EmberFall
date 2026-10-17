// Loads the bundled content once, validates it, and exposes one frozen copy.
// Game modules read tuning from here; nothing else holds a second copy.
import combat from '../config/combat.json?v=65' with {type:'json'};
import weapons from '../config/weapons.json?v=59' with {type:'json'};
import armor from '../config/armor.json?v=59' with {type:'json'};
import consumables from '../config/consumables.json?v=59' with {type:'json'};
import cosmetics from '../config/cosmetics.json?v=26' with {type:'json'};
import progression from '../config/progression.json?v=68' with {type:'json'};
import bots from '../config/bots.json?v=59' with {type:'json'};
import events from '../config/events.json?v=55' with {type:'json'};
import {parseConfig,CONFIG_FILES,SCHEMA_VERSION} from './config-schema.js?v=68';
import {deepFreeze,contentHash} from './schema.js?v=26';

const raw={combat,weapons,armor,consumables,cosmetics,progression,bots,events};
export const CONFIG=deepFreeze(parseConfig(raw));
// Identifies the exact content so a future server and its clients can confirm they match.
export const CONFIG_VERSION=`${SCHEMA_VERSION}-${contentHash(JSON.stringify(CONFIG_FILES.map(name=>raw[name])))}`;
