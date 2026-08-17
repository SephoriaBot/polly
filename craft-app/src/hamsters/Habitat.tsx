import { useState } from "react";
import HamsterNest from "../hamsters/HamsterNest";
import HamsterHabitat from "../hamsters/HamsterHabitat";
import WildEncounter from "../hamsters/WildEncounter";
import HabitatScene from "../hamsters/HabitatScene";
import Lantern from "../components/Lantern";
import PageTabs, { type PageTab } from "../components/PageTabs";

// HamsterGrowthProvider now wraps the whole app in App.tsx (so the growth
// check runs on every load and WildEncounterAlert can pop up from any
// page) — no provider needed here anymore, just consume the context.

type HabitatTab = 'shelf' | 'nest' | 'wild' | 'collection';

const HABITAT_TABS: PageTab<HabitatTab>[] = [
  { key: 'shelf', label: 'Shelf', icon: 'house' },
  { key: 'nest', label: 'Nest', icon: 'egg-nest' },
  { key: 'wild', label: 'Wild Encounter', icon: 'hamster-wild' },
  { key: 'collection', label: 'Collection', icon: 'trophy' },
];

export default function Habitat() {
  const [activeTab, setActiveTab] = useState<HabitatTab>('shelf');

  return (
    <div>
      <div className="page-header">
        <div className="title-row">
          <h1>Habitat</h1>
          <Lantern />
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
          <div className="section-label">Hamster Nest</div>
          <HamsterNest />
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
          <HamsterHabitat />
        </section>
      )}
    </div>
  );
}
