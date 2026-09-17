import { useState } from "react";
import CreatureBreeder from "../creatures/CreatureBreeder";
import CreatureHabitat from "../creatures/CreatureHabitat";
import WildEncounter from "../creatures/WildEncounter";
import HabitatScene from "../creatures/HabitatScene";
import IncubatorTab from "../creatures/IncubatorTab";
import Closet from "../creatures/Closet";
import PageTabs, { type PageTab } from "../components/PageTabs";
import PageTitleLogo from "../components/PageTitleLogo";
import { useAuth } from "../context/AuthContext";

// CreatureGrowthProvider now wraps the whole app in App.tsx (so the growth
// check runs on every load and WildEncounterAlert can pop up from any
// page) — no provider needed here anymore, just consume the context.

type HabitatTab = 'shelf' | 'breeder' | 'incubator' | 'wild' | 'collection' | 'closet';

const HABITAT_TABS: PageTab<HabitatTab>[] = [
  { key: 'shelf', label: 'Shelf', icon: 'tab-shelf' },
  { key: 'breeder', label: 'Breeder', icon: 'tab-breeder' },
  { key: 'incubator', label: 'Incubator', icon: 'tab-breeder' }, // swap in a dedicated egg icon when you have one
  { key: 'wild', label: 'Wild Encounter', icon: 'tab-encounter' },
  { key: 'collection', label: 'Collection', icon: 'trophy' },
  { key: 'closet', label: 'Closet', icon: 'sparkle-single' }, // swap in a dedicated hat icon when you have one
];

export default function Habitat({ initialTab }: { initialTab?: HabitatTab }) {
  const [activeTab, setActiveTab] = useState<HabitatTab>(initialTab ?? 'shelf');
  const { user } = useAuth();

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

      {activeTab === 'incubator' && user && (
        <section>
          <div className="section-label">Incubator</div>
          <IncubatorTab userId={user.id} />
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

      {activeTab === 'closet' && (
        <section>
          <div className="section-label">Closet</div>
          <Closet />
        </section>
      )}
    </div>
  );
}