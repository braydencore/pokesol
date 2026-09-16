import town from "../../client/src/assets/tilemaps/town.json";
import route1 from "../../client/src/assets/tilemaps/route1.json";
import route2 from "../../client/src/assets/tilemaps/route2.json";
import ashveld from "../../client/src/assets/tilemaps/ashveld.json";
import crysthaven from "../../client/src/assets/tilemaps/crysthaven.json";
import pokemonCenterTown from "../../client/src/assets/tilemaps/pokemon_center_town.json";
import pokemonCenterAshveld from "../../client/src/assets/tilemaps/pokemon_center_ashveld.json";
import pokemonCenterCrysthaven from "../../client/src/assets/tilemaps/pokemon_center_crysthaven.json";

export const MAPS = {
    town,
    route1,
    route2,
    ashveld,
    crysthaven,
    pokemon_center_town: pokemonCenterTown,
    pokemon_center_ashveld: pokemonCenterAshveld,
    pokemon_center_crysthaven: pokemonCenterCrysthaven
};

export const KNOWN_MAPS = Object.keys(MAPS);
