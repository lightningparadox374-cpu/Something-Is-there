import { ChapterBlueprint } from '../types/game';

export const CHAPTER_BLUEPRINTS: ChapterBlueprint[] = [
  {
    chapterNumber: 1,
    title: 'Chapter 1: The Awakening',
    subtitle: 'Power Voltage Room & The Black & Yellow Door',
    environmentMood: 'Dense black fog, flickering ceiling tubes, damp carpet, distant footsteps.',
    primaryEntity: 'The Stalker — Emerges from the black fog with two staring white eyes and a gaping white mouth.',
    playableInDemo: true,
    steps: [
      {
        stepNumber: 1,
        title: 'The First Awakening',
        objective: 'Search the West Wing corridors to find the Heavy Crowbar.',
        hint: 'Check the utility table along the West Wing hallway; grab spare batteries on your way.',
      },
      {
        stepNumber: 2,
        title: 'The Power Voltage Room',
        objective: 'Use the Crowbar to pry open the barricaded Power Voltage Room in the south corridor.',
        hint: 'Look along the south hallway north wall for the sealed High-Voltage warning door.',
      },
      {
        stepNumber: 3,
        title: 'Switch On The Power',
        objective: 'Step inside the Power Voltage Room and switch on the glowing Power Button.',
        hint: 'Press E on the high-voltage breaker panel to energize the Black & Yellow Door.',
      },
      {
        stepNumber: 4,
        title: 'The Black & Yellow Door',
        objective: 'Access the powered Black & Yellow Door and retrieve the Old Brass Key inside.',
        hint: 'The Black & Yellow hazard door stands in the central south corridor; hide in lockers if footsteps draw near.',
      },
      {
        stepNumber: 5,
        title: 'Return To Our World',
        objective: 'Unlock the North-East Exit Door with the Old Brass Key and step back into our world.',
        hint: 'Head north-east toward the Exit Bulkhead—once unlocked, step through into daylight!',
      },
    ],
    keyPuzzles: [
      'Heavy Crowbar → Pry Open Power Voltage Room Door',
      'Power Button Switch → Energizes Black & Yellow Hazard Door',
      'Old Brass Key → Exit Door Back to Our World',
    ],
    endingSummary: 'You unlock the final bulkhead and step into blinding morning sunlight—leaving the black fog and staring white face behind.',
  },
  {
    chapterNumber: 2,
    title: 'Chapter 2: The Abandoned Facility',
    subtitle: 'Sub-Level Maintenance & Security Sector',
    environmentMood: 'Rusted steel catwalks, emergency amber strobes, flooded concrete, failing backup breakers.',
    primaryEntity: 'The Stalker + The Mimic (imitates distorted human distress calls and Radio static).',
    playableInDemo: false,
    steps: [
      {
        stepNumber: 1,
        title: 'Entering the Facility',
        objective: 'Descend the service stairwell and locate Bolt Cutters in the tool crib.',
        hint: 'Cut chained security gates without alerting patrols.',
      },
      {
        stepNumber: 2,
        title: 'Restoring Power',
        objective: 'Recover three Generator Components and route auxiliary power to Sector B.',
        hint: 'Restoring power turns overhead floodlights back on—creating blind shadow pockets.',
      },
      {
        stepNumber: 3,
        title: 'The Security Room',
        objective: 'Swipe the Security Keycard and read the 4-digit Containment Keypad code on the CCTV logs.',
        hint: 'Check Security Record #04 for the shifted cipher.',
      },
      {
        stepNumber: 4,
        title: 'The Locked Sector',
        objective: 'Bypass the Containment Keypad and extract the Access Chip.',
        hint: 'Wrong keypad entries emit a loud klaxon.',
      },
      {
        stepNumber: 5,
        title: 'Something Escaped',
        objective: 'Outrun the breached containment alarm and board the Freight Elevator.',
        hint: 'Throw a Noise Maker to pull The Stalker away from the elevator shaft.',
      },
    ],
    keyPuzzles: [
      'Bolt Cutters → Chained Tool Crib Gate',
      'Keycard → Security Monitoring Room',
      'CCTV Log Cipher → Containment Keypad',
      'Generator Components → Freight Elevator Power',
    ],
    endingSummary: 'The freight elevator cables snap halfway down, plunging you into unmapped subterranean tunnels beneath the facility.',
  },
  {
    chapterNumber: 3,
    title: 'Chapter 3: The Deep Darkness',
    subtitle: 'Subterranean Tunnels & Dead Air',
    environmentMood: 'Near-total pitch darkness, damp brick tunnels, dying emergency flares, directional echo.',
    primaryEntity: 'The Static — Blind acoustic predator sensitive only to footsteps, doors, and flashlight clicks.',
    playableInDemo: false,
    steps: [
      {
        stepNumber: 1,
        title: 'The Underground',
        objective: 'Survive the collapsed elevator shaft and ignite an Emergency Flare.',
        hint: 'Your flashlight flickers violently near magnetic anomalies.',
      },
      {
        stepNumber: 2,
        title: 'The Broken Tunnel',
        objective: 'Locate the Crowbar and pry open the jammed railcar bulkhead.',
        hint: 'Crouch-walk past The Static when its radio crackle intensifies.',
      },
      {
        stepNumber: 3,
        title: 'The Pursuit',
        objective: 'Navigate the flooded culvert maze using Glow Sticks to mark explored branches.',
        hint: 'Avoid stepping into deep water puddles—splashes carry far.',
      },
      {
        stepNumber: 4,
        title: 'The Generator',
        objective: 'Repair the Sub-Station Turbine with the Hammer and Strange Liquid coolant.',
        hint: 'Hammer strikes are loud; wait until patrol sweeps clear.',
      },
      {
        stepNumber: 5,
        title: 'The Unknown Door',
        objective: 'Cross the energized bridge and unseal the Vault Threshold.',
        hint: 'Recover Reality Fragment #01 embedded in the vault frame.',
      },
    ],
    keyPuzzles: [
      'Crowbar → Jammed Railcar Passage',
      'Glow Sticks → Culvert Maze Breadcrumbing',
      'Hammer + Strange Liquid → Sub-Station Turbine Repair',
    ],
    endingSummary: 'Behind the Vault Threshold, geometry stops obeying architecture—gravity shifts as the walls fold inward.',
  },
  {
    chapterNumber: 4,
    title: 'Chapter 4: The Lost Reality',
    subtitle: 'Fractured Memories & The Archive',
    environmentMood: 'Warped corridors, floating debris, inverted doorways, impossible staircases, red-shifted fog.',
    primaryEntity: 'The Hollow — Phases through non-solid walls when stared at too long; repelled by turning your beam off.',
    playableInDemo: false,
    steps: [
      {
        stepNumber: 1,
        title: 'Reality Distortion',
        objective: 'Use the Old Map to recognize looping hallways and find the True Door.',
        hint: 'Fake exits buzz louder and lack floor baseboard trim.',
      },
      {
        stepNumber: 2,
        title: 'The Forgotten People',
        objective: 'Collect three Mysterious Photographs and Memory Tapes from past victims.',
        hint: 'Listen to the Radio frequencies tuned to 104.2 MHz.',
      },
      {
        stepNumber: 3,
        title: 'The Truth',
        objective: 'Unlock the Research Archive and read the Entity Research File.',
        hint: 'Discover why the Backrooms replicates human memories as traps.',
      },
      {
        stepNumber: 4,
        title: 'The Final Hunt',
        objective: 'Gather three Reality Fragments while both The Stalker and The Hollow converge.',
        hint: 'Cut your flashlight when The Hollow freezes in your peripheral vision.',
      },
      {
        stepNumber: 5,
        title: 'The Last Gate',
        objective: 'Slot the Reality Fragments into the Threshold Pedestal to stabilize the exit.',
        hint: 'Do not enter the false glowing exit on the left wing.',
      },
    ],
    keyPuzzles: [
      'Fake vs. Real Exit Observation Puzzle',
      'Radio Frequency Cipher → Research Archive Lock',
      '3 Reality Fragments → Dimensional Gate Stabilization',
    ],
    endingSummary: 'The archive tears open into a blinding white seam—revealing the final collapsing corridor back to Earth.',
  },
  {
    chapterNumber: 5,
    title: 'Final Chapter: The Return',
    subtitle: 'Collapse & Escape to the Open World',
    environmentMood: 'Violent seismic shaking, shattering ceiling tiles, blinding daylight bleeding through the final seam.',
    primaryEntity: 'The Stalker (Relentless Enraged State) — Relentless final pursuit.',
    playableInDemo: false,
    steps: [
      {
        stepNumber: 1,
        title: 'The Final Passage',
        objective: 'Tie the Rope to the collapsed service shaft and descend into the Anchor Corridor.',
        hint: 'Keep sprint stamina conserved for the bridge.',
      },
      {
        stepNumber: 2,
        title: 'The Last Entity',
        objective: 'Lure The Stalker past the ruptured steam valve using a Noise Maker.',
        hint: 'Lock the emergency blast shutters behind you.',
      },
      {
        stepNumber: 3,
        title: 'The Escape',
        objective: 'Sprint down the collapsing corridor toward the sunlit threshold.',
        hint: 'Do not turn back when footsteps accelerate behind you.',
      },
      {
        stepNumber: 4,
        title: 'Back to Reality',
        objective: 'Step through the Exit Portal into the peaceful, sunlit open world.',
        hint: 'Final story reveal, radio silence, and credits.',
      },
    ],
    keyPuzzles: [
      'Rope → Service Shaft Anchor Descent',
      'Steam Valve + Blast Shutter → Final Stalker Lockdown',
      'Timed Collapse Escape Sequence',
    ],
    endingSummary: 'You stumble out onto wet morning grass under an open blue sky. Behind you, the doorway vanishes—yet on the Radio, one last breath whispers from the static.',
  },
];

export interface CodexEntity {
  name: string;
  chapterDebut: string;
  detectionMethod: string;
  weakness: string;
  behaviorSummary: string;
}

export const ENTITY_CODEX: CodexEntity[] = [
  {
    name: 'The Stalker',
    chapterDebut: 'Chapter 1: The Awakening',
    detectionMethod: 'Direct line-of-sight cone + footsteps (running, doors, fuse surges).',
    weakness: 'Loses visual lock around sharp corridor turns; fooled by lockers if unseen entering.',
    behaviorSummary: 'A 2.85-meter obsidian humanoid with unnaturally long arms. Patrols independently, investigates suspicious sounds, searches nearby hiding spots, and stalks silently in the fog.',
  },
  {
    name: 'The Mimic',
    chapterDebut: 'Chapter 2: The Abandoned Facility',
    detectionMethod: 'Proximity ambush triggered when players investigate false distress audio.',
    weakness: 'Distorted metallic audio cadence betrays its fake voices; avoid following unverified calls.',
    behaviorSummary: 'Mimics human voices and radio static from behind locked doors to lure survivors off the main route.',
  },
  {
    name: 'The Static',
    chapterDebut: 'Chapter 3: The Deep Darkness',
    detectionMethod: 'Purely acoustic—tracks running, splashing water, hammer hits, and flashlight clicks.',
    weakness: 'Crouch-walking and Noise Makers completely redirect its lunge path.',
    behaviorSummary: 'A blind subterranean entity emitting localized electromagnetic interference that warps flashlight beams before it charges.',
  },
  {
    name: 'The Hollow',
    chapterDebut: 'Chapter 4: The Lost Reality',
    detectionMethod: 'Visual lock—accelerates when illuminated by direct flashlight beams.',
    weakness: 'Switch off your flashlight and look away to force it back into the fog.',
    behaviorSummary: 'A reality-warped apparition that manifests at the edge of your light cone and distorts corridor geometry.',
  },
];
