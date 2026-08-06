import HamsterNest from "../hamsters/HamsterNest";
import HamsterHabitat from "../hamsters/HamsterHabitat";
import WildEncounter from "../hamsters/WildEncounter";
import Lantern from "../components/Lantern";
import Icon from "../components/Icon";

// HamsterGrowthProvider now wraps the whole app in App.tsx (so the growth
// check runs on every load and WildEncounterAlert can pop up from any
// page) — no provider needed here anymore, just consume the context.

export default function Habitat() {
  return (
    <div>
      <div className="page-header">
        <div className="title-row">
          <h1>Habitat</h1>
          <Lantern />
        </div>
      </div>

      <section>
        <div className="section-label">Hamster Nest</div>
        <HamsterNest />
      </section>

<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
  <Icon name="pagedivider" size={85} />
</div>

      <section>
        <div className="section-label">Wild Encounter</div>
        <WildEncounter />
      </section>

<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
  <Icon name="pagedivider" size={85} />
</div>

      <section>
        <div className="section-label">Collection</div>
        <HamsterHabitat />
      </section>
    </div>
  );
}