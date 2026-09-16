import { useState } from "react";
import CreatureBreeder from "../creatures/CreatureBreeder";
import CreatureHabitat from "../creatures/CreatureHabitat";
import WildEncounter from "../creatures/WildEncounter";
import HabitatScene from "../creatures/HabitatScene";
import PageTabs, { type PageTab } from "../components/PageTabs";
import PageTitleLogo from "../components/PageTitleLogo";

// CreatureGrowthProvider now wraps the whole app in App.tsx (so the growth
// check runs on every load and WildEncounterAlert can pop up from any
// page) — no provider needed here anymore, just consume the context.

type HabitatTab = 'shelf' | 'breeder' | 'wild' | 'collection';

const HABITAT_TABS: PageTab<HabitatTab>[] = [
  { key: 'shelf', label: 'Shelf', icon: 'tab-shelf' },
  { key: 'breeder', label: 'Breeder', icon: 'tab-breeder' },
  { key: 'wild', label: 'Wild Encounter', icon: 'tab-encounter' },
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

      {activeTab === 'breeder' && (
        <section>
          <div className="section-label">The Breeder</div>
          <CreatureBreeder />
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