export type RuleCategory = 'LEGAL' | 'INTERNAL' | 'DEMONSTRATION';
export type ServiceCategory = 'CELLULAR_MOBILE' | 'FIXED_DATA' | 'PUBLIC_INTERNET' | 'INFRASTRUCTURE_SHARING' | 'DATA_PROTECTION';

export interface Obligation {
  id: string;
  version: string;
  category: RuleCategory;
  serviceCategory?: ServiceCategory;
  instrument: string;
  title: string;
  jurisdiction: 'Zimbabwe';
  reference: string;
  sourceUrl: string;
  sourceHash?: string;
  sourceVerified: boolean;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  lineage: string[];
  amendmentCheck: string;
  entity: string;
  service: string;
  technologies: string[];
  level: 'CELL' | 'ORGANISATION' | 'INFRASTRUCTURE';
  metric: string | null;
  unit: string | null;
  numerator: string | null;
  denominator: string | null;
  comparator: '>=' | '<=' | null;
  threshold: number | null;
  window: string | null;
  reporting: string;
  correctiveAction: string;
  conditions: string;
  exceptions: string;
  requiredEvidence: string[];
  owner: string;
  reviewStatus: 'DRAFT' | 'UNDER_REVIEW' | 'REVIEWED';
  reviewer: string | null;
  reviewDate: string | null;
  reviewNote: string | null;
  applicability: 'UNASSESSED' | 'APPLICABLE' | 'NOT_APPLICABLE';
  administrativeProcess?: string;
  penaltyStatus?: 'ADVISORY_EXPOSURE_ONLY' | 'HEARING_PENDING' | 'CONFIRMED_PENALTY';
  estimatedExposureAmountUSD?: number;
}

const defaults = {
  version: '1',
  category: 'LEGAL' as const,
  serviceCategory: 'CELLULAR_MOBILE' as ServiceCategory,
  jurisdiction: 'Zimbabwe' as const,
  sourceVerified: false,
  effectiveFrom: null,
  effectiveTo: null,
  lineage: [],
  amendmentCheck: 'Subsequent amendments and consolidated current law not yet confirmed.',
  entity: 'Operator/controller applicability requires owner review',
  service: 'Applicability unassessed',
  technologies: [] as string[],
  level: 'ORGANISATION' as const,
  metric: null,
  unit: null,
  numerator: null,
  denominator: null,
  comparator: null,
  threshold: null,
  window: null,
  reporting: 'No automatic report or notification',
  correctiveAction: 'Owner review required',
  conditions: 'Do not infer NetOne applicability from a public template.',
  exceptions: 'Exceptions require documented review',
  requiredEvidence: ['Applicability analysis', 'Source and owner review'],
  owner: 'Regulatory owner / DPO to be assigned',
  reviewStatus: 'DRAFT' as const,
  reviewer: null,
  reviewDate: null,
  reviewNote: null,
  applicability: 'UNASSESSED' as const,
  administrativeProcess: 'SI 154/2024 s.3 (replacing SI 42/2016 s.9): Notice of substandard performance -> Directed remediation plan -> Formal administrative hearing -> Determination',
  penaltyStatus: 'ADVISORY_EXPOSURE_ONLY' as const,
  estimatedExposureAmountUSD: 0
};

export const OBLIGATIONS: Obligation[] = [
  // 1. Cellular Mobile Service Quality Rules (SI 154 of 2024 First Schedule Part I)
  ...[
    { id: 'QOS-DSASR', metric: 'dsasr', title: 'Data service access success rate', threshold: 95, comparator: '>=' as const, numerator: 'Successful data access establishments', denominator: 'Data access attempts', estimatedExposureAmountUSD: 5000 },
    { id: 'QOS-DSDR', metric: 'dsdr', title: 'Data service drop rate', threshold: 2, comparator: '<=' as const, numerator: 'Abnormally released data sessions', denominator: 'Successful data access establishments', estimatedExposureAmountUSD: 5000 },
    { id: 'QOS-CA', metric: 'cellAvailability', title: 'Cell availability / uptime', threshold: 67, comparator: '>=' as const, numerator: 'Hours cell available for service', denominator: '24 hours in the observed day', estimatedExposureAmountUSD: 7500 }
  ].map(x => ({
    ...defaults,
    ...x,
    serviceCategory: 'CELLULAR_MOBILE' as ServiceCategory,
    instrument: 'SI 42/2016 as amended by SI 154/2024',
    reference: 'SI 154/2024 s.4; First Schedule (s.6), cellular service KPI table',
    sourceUrl: 'https://www.veritaszim.net/node/7181',
    sourceHash: 'a6770a6b19dddce6be8d556c0452673d44c0c5c78e777bc80407847a0ab245c1',
    sourceVerified: true,
    effectiveFrom: '2024-09-06',
    lineage: ['SI 42 of 2016 principal', 'SI 154 of 2024 amendment s.4'],
    entity: 'Cellular telecommunications licensee; NetOne licence/directions outstanding',
    service: 'Cellular data/service',
    technologies: ['3G', '4G', '5G'],
    level: 'CELL' as const,
    unit: '%',
    window: x.id === 'QOS-CA' ? 'Daily 24-hour observation; ≥16 hours/day annotation alongside 67% target; owner must confirm probing protocol' : 'Prescribed cell observation period; owner must confirm protocol',
    reporting: 'SI 154 s.3 replacing s.9(5): measurement-file submission at hourly intervals after generation, in required format',
    correctiveAction: 's.9(2)–(4),(7): staged cell/warning assessment and directed remediation; no inferred automatic fine',
    exceptions: 's.9(7)(e) cell exemptions including power utility grid loss; s.9(8) extensions; applicability/measurement protocol required',
    requiredEvidence: ['Cell counters with numerator/denominator', 'Complete comparable observation window', 'Applicable licence and directions', 'Exemption/extension assessment', 'Regulatory owner review']
  })),

  // 2. Fixed Data and Public Internet Access Service Quality Rules (SI 154 of 2024 First Schedule Part III)
  {
    ...defaults,
    id: 'QOS-FIXED-LATENCY',
    serviceCategory: 'FIXED_DATA',
    instrument: 'SI 42/2016 as amended by SI 154/2024',
    title: 'Fixed data & internet access round-trip latency',
    reference: 'SI 154/2024 s.4; First Schedule (s.6), Part III Public Data/Internet Services',
    sourceUrl: 'https://www.veritaszim.net/node/7181',
    sourceHash: 'a6770a6b19dddce6be8d556c0452673d44c0c5c78e777bc80407847a0ab245c1',
    sourceVerified: true,
    effectiveFrom: '2024-09-06',
    level: 'ORGANISATION',
    entity: 'Public data and internet access service licensee',
    service: 'Fixed internet / IP transit / leased lines',
    technologies: ['Fiber', 'Microwave', 'Fixed Wireless'],
    metric: 'latencyMs',
    unit: 'ms',
    comparator: '<=',
    threshold: 100,
    window: 'Monthly average across synthetic ping probe points',
    numerator: 'Sum of round-trip probe times (ms)',
    denominator: 'Total valid probe samples',
    reporting: 'Monthly QoS compliance return to POTRAZ',
    correctiveAction: 'Routing optimization, peering exchange capacity expansion, and SLA credits',
    conditions: 'Applies to fixed data and internet connectivity; does not govern cellular air interface',
    exceptions: 'Subsea cable fiber breaks and upstream international transit outages outside licensee control',
    requiredEvidence: ['BGP probe logs', 'International gateway SLA records', 'Upstream carrier incident tickets'],
    estimatedExposureAmountUSD: 4000
  },
  {
    ...defaults,
    id: 'QOS-FIXED-PACKET-LOSS',
    serviceCategory: 'PUBLIC_INTERNET',
    instrument: 'SI 42/2016 as amended by SI 154/2024',
    title: 'Public data and internet access packet loss rate',
    reference: 'SI 154/2024 s.4; First Schedule (s.6), Part III Public Data/Internet Services',
    sourceUrl: 'https://www.veritaszim.net/node/7181',
    sourceHash: 'a6770a6b19dddce6be8d556c0452673d44c0c5c78e777bc80407847a0ab245c1',
    sourceVerified: true,
    effectiveFrom: '2024-09-06',
    level: 'ORGANISATION',
    entity: 'Public data and internet access service licensee',
    service: 'Fixed internet and core IP transport',
    technologies: ['Fiber', 'Core IP', 'Fixed Wireless'],
    metric: 'packetLossRate',
    unit: '%',
    comparator: '<=',
    threshold: 1.0,
    window: 'Monthly observation window across core and aggregation links',
    numerator: 'Lost IP packets in measurement stream',
    denominator: 'Total transmitted IP packets in stream',
    reporting: 'Periodic electronic quality returns',
    correctiveAction: 'Congestion relief, interface buffer tuning, link augmentation',
    conditions: 'Applies to fixed data transport; separate from radio bearer drop rates',
    exceptions: 'Direct third-party backhaul cuts undergoing emergency restoration',
    requiredEvidence: ['Router interface statistics', 'NetFlow/IPFIX monitoring records', 'Carrier maintenance logs'],
    estimatedExposureAmountUSD: 4000
  },
  {
    ...defaults,
    id: 'QOS-FIXED-RESTORE',
    serviceCategory: 'FIXED_DATA',
    instrument: 'SI 42/2016 as amended by SI 154/2024',
    title: 'Major data outage mean restoration timeline (MTTR)',
    reference: 'SI 154/2024 s.4; First Schedule (s.6), Part III Outage Provisions',
    sourceUrl: 'https://www.veritaszim.net/node/7181',
    sourceHash: 'a6770a6b19dddce6be8d556c0452673d44c0c5c78e777bc80407847a0ab245c1',
    sourceVerified: true,
    effectiveFrom: '2024-09-06',
    level: 'INFRASTRUCTURE',
    entity: 'Data network operator / infrastructure licensee',
    service: 'Fixed data and transmission backhaul',
    technologies: ['Fiber', 'Microwave Backhaul'],
    metric: 'mttrHours',
    unit: 'hours',
    comparator: '<=',
    threshold: 4.0,
    window: 'Per major transmission incident event',
    numerator: 'Elapsed hours from alarm receipt to service restoration',
    denominator: 'Number of major outage events in period',
    reporting: 'Immediate notice within 2 hours of major failure, followed by root-cause incident dossier',
    correctiveAction: 'Field technician rapid response, fiber splicing standby contracts, backhaul route diversity',
    conditions: 'Applies to transmission trunk and backhaul infrastructure impacting >= 10,000 subscribers or >= 3 base stations',
    exceptions: 'Force majeure, road construction severance with delayed municipal permits, civil access denial',
    requiredEvidence: ['NOC trouble ticket lifecycle', 'Field technician dispatch timestamps', 'Authority incident notification confirmation'],
    estimatedExposureAmountUSD: 6000
  },

  // 3. Infrastructure Sharing (SI 137/2016)
  {
    ...defaults,
    id: 'SHARE-OPTIONS',
    serviceCategory: 'INFRASTRUCTURE_SHARING',
    instrument: 'SI 137/2016',
    title: 'Infrastructure sharing options and approvals',
    reference: 'ss.3,7,8,9,10,12,13; First/Second/Fourth Schedules',
    sourceUrl: 'https://www.veritaszim.net/node/1898',
    sourceHash: '1dad7452db0c07ff1babcd11ef517e9ba759c2a8b5620a24866e63f165c18cd5',
    sourceVerified: true,
    effectiveFrom: '2016-11-04',
    level: 'INFRASTRUCTURE',
    entity: 'Telecommunication licence holders; infrastructure seeker/provider',
    service: 'Infrastructure sharing',
    conditions: 'Amenability, technical safety, capacity reservation and approvals must be evidenced',
    requiredEvidence: ['Infrastructure type and spare-capacity evidence', 'Technical/commercial terms', 'Request and negotiation records', 'Authority approval reference'],
    reporting: 's.8 written request/response; s.9 negotiation and agreement; s.10 Authority approval',
    correctiveAction: 'Assess build/upgrade/share alternatives; no assumption that utilisation establishes spare infrastructure capacity',
    exceptions: 's.12 reserved spare capacity and s.13 technical requirements; exact applicability reviewed per option',
    lineage: ['SI 137/2016 original gazetted text']
  },

  // 4. Data Protection & Cybersecurity (SI 155/2024 & Act 5/2021)
  {
    ...defaults,
    id: 'DP-LICENCE',
    serviceCategory: 'DATA_PROTECTION',
    instrument: 'Cyber and Data Protection Act [12:07]; SI 155/2024',
    title: 'Controller applicability and DPO governance',
    reference: 'SI 155 ss.3,4,8,10,12–14,16,17; Forms DP1/DP2/DP3',
    sourceUrl: 'https://www.veritaszim.net/node/7187',
    sourceHash: '53625dc9bd592236f9997c62a483b2e0734eb14a44edff280adabfc3dd3006ca',
    sourceVerified: true,
    effectiveFrom: '2024-09-13',
    conditions: 'Assess who determines purposes/means; licensing exemptions and relationships separately; no automatic controller classification',
    requiredEvidence: ['Processing inventory', 'Controller/processor analysis', 'DPO applicability, appointment and certification', 'Licence/exemption references where applicable', 'Security/breach procedures'],
    exceptions: 's.8 licensing exemptions require assessment; no unverified notification deadline encoded',
    lineage: ['Act 5/2021', 'SI 155/2024']
  },
  {
    ...defaults,
    id: 'DP-GUIDANCE',
    serviceCategory: 'DATA_PROTECTION',
    instrument: 'POTRAZ DPA implementation guidelines CDPG 1/2025',
    title: 'Governance evidence and processing inventory',
    reference: 'Compliance Assessments §5(c); Annexure A sections A,C,E,G',
    sourceUrl: 'https://www.veritaszim.net/sites/veritas_d/files/Cyber%20and%20Data%20Protection%20Act%20Implementation%20Guidlines.pdf',
    sourceVerified: true,
    requiredEvidence: ['Processing records and agreements', 'Minimisation and retention policy', 'Security/breach plan', 'DPIA applicability assessment'],
    conditions: 'Guidance evidence checklist, not automatic legal certification; effective date for this module not verified'
  },
  {
    ...defaults,
    id: 'QOS-PRINCIPAL',
    serviceCategory: 'CELLULAR_MOBILE',
    instrument: 'SI 42/2016',
    title: 'Principal QoS framework',
    reference: 'ss.2,3,6; First Schedule; s.9 superseded by SI 154/2024 s.3',
    sourceUrl: 'https://www.veritaszim.net/node/1670',
    sourceHash: 'fd89487f5b3235e0bcf0baf15617f990ea9843b6976777ad150efe30881fd98b',
    sourceVerified: true,
    effectiveFrom: '2016-04-15',
    lineage: ['SI 42/2016 original', 'SI 154/2024 amendment; s.9 substitution'],
    conditions: 'Original principal text retrieved; no claim of complete current consolidation. Owner review remains required'
  },
  {
    ...defaults,
    id: 'DP-ACT',
    serviceCategory: 'DATA_PROTECTION',
    instrument: 'Cyber and Data Protection Act [Chapter 12:07], Act 5/2021',
    title: 'Personal data protection principles and security',
    reference: 'ss.7,8,13,14,16–20,28',
    sourceUrl: 'https://www.veritaszim.net/node/5522',
    sourceHash: '2ccf96adc1a86fce753546dfecd2336006e46c28af1c18076cf98b1e1795b8d3',
    sourceVerified: true,
    conditions: 'Actual processing purposes, legal basis, security and cross-border applicability must be assessed; do not infer controller status',
    requiredEvidence: ['Data classification and purpose inventory', 'Minimisation/retention decisions', 'Processing agreements', 'DPO and cross-border review'],
    lineage: ['Act 5/2021; gazetted copy published 11 March 2022; commencement/date consolidation to verify']
  },
  {
    ...defaults,
    id: 'NETONE-LICENCE',
    serviceCategory: 'CELLULAR_MOBILE',
    instrument: 'Actual NetOne licence and POTRAZ directions',
    title: 'Operator-specific licence obligations',
    reference: 'Not supplied',
    sourceUrl: '',
    conditions: 'Actual executed licence, amendments and directions must be supplied; public licence templates are not substitutes'
  }
];
