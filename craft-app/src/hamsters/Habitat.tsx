import HamsterNest from "../hamsters/HamsterNest";
import HamsterHabitat from "../hamsters/HamsterHabitat";
import WildEncounter from "../hamsters/WildEncounter";
import { HamsterGrowthProvider } from "../hamsters/HamsterGrowthContext";
import Lantern from "../components/Lantern";

export default function Habitat() {
  return (
    <div>
      <div className="page-header">
        <div className="title-row">
          <h1>Habitat</h1>
          <Lantern />
        </div>
      </div>

      <HamsterGrowthProvider>
        <section>
          <div className="section-label">Hamster Nest</div>
          <HamsterNest />
        </section>

        <Lantern variant="divider" />

        <section>
          <div className="section-label">Wild Encounter</div>
          <WildEncounter />
        </section>

        <Lantern variant="divider" />

        <section>
          <div className="section-label">Collection</div>
          <HamsterHabitat />
        </section>
      </HamsterGrowthProvider>
    </div>
  );
}