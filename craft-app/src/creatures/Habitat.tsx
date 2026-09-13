import { useState } from "react";
import CreatureNest from "../creatures/CreatureNest";
import CreatureHabitat from "../creatures/CreatureHabitat";
import WildEncounter from "../creatures/WildEncounter";
import HabitatScene from "../creatures/HabitatScene";
import PageTabs, { type PageTab } from "../components/PageTabs";
import PageTitleLogo from "../components/PageTitleLogo";

// CreatureGrowthProvider now wraps the whole app in App.tsx (so the growth
// check runs on every load and WildEncounterAlert can pop up from any
// page) — no provider needed here anymore, just consume the context.

type HabitatTab = 'shelf' | 'nest' | 'wild' | 'collection';

const HABITAT_TABS: PageTab<HabitatTab>[] = [
  { key: 'shelf', label: 'Shelf', icon: 'house' },
  { key: 'nest', label: 'Nest', icon: 'egg-nest' },
  { key: 'wild', label: 'Wild Encounter', icon: 'hamster-wild' },
  { key: 'collection', label: 'Collection', icon: 'trophy' },
];

export default function Habitat({ initialTab }: { initialTab?: HabitatTab }) {
  const [activeTab, setActiveTab] = useState<HabitatTab>(initialTab ?? 'shelf');

  return (
    <div>
      <div className="page-header">
        <div className="title-row">
          <h1><PageTitleLogo name="habitat" height={28} /></h1>
         
        </div>
      </div>

      <PageTabs tabs={HABITAT_TABS} active={activeTab} onChange={setActiveTab} />

      {activeTab === 'shelf' && (
        <section>
          <HabitatScene />
        </section>
      )}

      {activeTab === 'nest' && (
        <section>
          <div className="section-label">Creature Nest</div>
          <CreatureNest />
        </section>
      )}

      {activeTab === 'wild' && (
        <section>
          <div className="section-label">Wild Encounter</div>
          <WildEncounter />
        </section>
      )}

      {activeTab === 'collection' && (
        <section>
          <div className="section-label">Collection</div>
          <CreatureHabitat />
        </section>
      )}
    </div>
  );
}