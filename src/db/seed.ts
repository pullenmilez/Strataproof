import crypto from "crypto";
import { eq } from "drizzle-orm";
import { ReviewStatus } from "../server/enums.ts";
import { db } from "./index.ts";
import {
  basinProfiles,
  formationRecords,
  sourceLicences,
} from "./schema.ts";

const NIGERIAN_BASINS_TAXONOMY = [
  {
    basin_name: "Niger Delta Basin",
    basin_category: "Cenozoic Passive-Margin Deltaic Province",
    sub_basins_or_provinces: [
      "Northern Delta Depobelt",
      "Greater Ughelli Depobelt",
      "Central Swamp Depobelt",
      "Coastal Swamp Depobelt",
      "Shallow Offshore Depobelt",
      "Deepwater Toe-Thrust & Inner Fold Belt",
    ],
    tectonic_summary:
      "Syn-sedimentary gravity-driven growth faulting, rollover anticlines, shale diapirism, and deepwater toe-thrust folds.",
    stratigraphic_overview:
      "Diachronous tripartite succession: marine Akata Shale (base), paralic Agbada Formation, and continental Benin Sandstone (top).",
    known_uncertainties_and_gaps:
      "Deep Akata source-rock TOC/maturity calibration in ultra-deepwater; across-fault SGR sealing capacity in stacked Agbada reservoirs.",
  },
  {
    basin_name: "Anambra Basin",
    basin_category: "Cretaceous–Paleogene Intracratonic / Post-Santonian Foreland Basin",
    sub_basins_or_provinces: ["Onitsha-Nsukka Axis", "Enugu-Udi Escarpment", "Okigwe-Afikpo Syncline"],
    tectonic_summary:
      "Post-Santonian subsidence following Benue Trough inversion, overprinted by Cenozoic uplift and erosion.",
    stratigraphic_overview:
      "Nkporo/Enugu Shale, Mamu Coal Measures, Ajali Sandstone, Nsukka Formation, overlain by Imo and Ameki Groups.",
    known_uncertainties_and_gaps:
      "Magnitude of Cenozoic uplift/erosion affecting thermal maturity reconstruction and post-entrapment preservation.",
  },
  {
    basin_name: "Lower Benue Trough",
    basin_category: "Cretaceous Intracontinental Rift Basin",
    sub_basins_or_provinces: ["Abakaliki Anticlinorium", "Afikpo Syncline"],
    tectonic_summary:
      "Albian–Coniacian rift fill inverted during Santonian compressional folding and low-grade metamorphism.",
    stratigraphic_overview: "Asu River Group, Eze-Aku Group, and Awgu Formation.",
    known_uncertainties_and_gaps:
      "Santonian thermal overprint and trap breach risk across inverted anticlinorial structures.",
  },
  {
    basin_name: "Middle Benue Trough",
    basin_category: "Cretaceous Intracontinental Rift Basin",
    sub_basins_or_provinces: ["Lafia-Obi Sub-basin", "Keana Anticline"],
    tectonic_summary: "NE–SW trending rift segment with transpressional folding and localized igneous intrusions.",
    stratigraphic_overview: "Asu River Group, Awe, Keana, Eze-Aku, Awgu, and Lafia Formations.",
    known_uncertainties_and_gaps:
      "Sparse deep well calibration and localized igneous contact metamorphism of source horizons.",
  },
  {
    basin_name: "Upper Benue Trough",
    basin_category: "Cretaceous Intracontinental Rift Basin",
    sub_basins_or_provinces: ["Lau-Gombe Sub-basin", "Lamurde Anticline"],
    tectonic_summary:
      "Bifurcating rift arm transitioning into the Gongola and Yola arms with Santonian–Maastrichtian deformation.",
    stratigraphic_overview:
      "Bima Sandstone, Yolde Formation, Dukul/Jessu/Sekuliye/Numanha Formations, and Lamja Sandstone.",
    known_uncertainties_and_gaps: "Lateral continuity of marine Cenomanian–Turonian source shales and fault-seal integrity.",
  },
  {
    basin_name: "Gongola Basin",
    basin_category: "Cretaceous Rift Arm (Northern Benue Branch)",
    sub_basins_or_provinces: ["Kolmani River Trend", "Gombe-Nafada Axis"],
    tectonic_summary:
      "N–S trending rift grabens and horst blocks bounded by basement-involved normal and inverted faults.",
    stratigraphic_overview: "Bima Group, Yolde Formation, Pindiga Formation, Gombe Sandstone, and Kerri-Kerri Formation.",
    known_uncertainties_and_gaps: "Variable Pindiga shale organic facies quality and structural compartmentalization.",
  },
  {
    basin_name: "Yola Basin",
    basin_category: "Cretaceous Rift Arm (Eastern Benue Branch)",
    sub_basins_or_provinces: ["Numan-Yola Graben", "Demsa-Mayo Belwa Axis"],
    tectonic_summary: "E–W trending rift arm controlled by wrench and dip-slip basement faults.",
    stratigraphic_overview:
      "Bima Sandstone, Yolde, Dukul, Jessu, Sekuliye, Numanha, and Lamja Formations.",
    known_uncertainties_and_gaps: "Very low well control density and limited public organic geochemistry datasets.",
  },
  {
    basin_name: "Bida Basin (Mid-Niger Basin)",
    basin_category: "Campanian–Maastrichtian Intracratonic Sag / Wrench Basin",
    sub_basins_or_provinces: ["Northern Bida Sub-basin", "Southern Bida (Lokoja) Sub-basin"],
    tectonic_summary: "NW–SE trending intracratonic basin bounded by basement shear zones with gentle dips.",
    stratigraphic_overview:
      "Bida/Lokoja Sandstone, Sakpe Ironstone, Enagi/Patti Siltstone-Shale, and Batati/Agbaja Ironstone.",
    known_uncertainties_and_gaps:
      "Insufficient burial depth for thermal maturation across basin margins; scarcity of deep stratigraphic wells.",
  },
  {
    basin_name: "Dahomey Basin (Benin Basin)",
    basin_category: "Mesozoic–Cenozoic Coastal Margin Basin",
    sub_basins_or_provinces: ["Onshore Ogun-Lagos Block", "Okitipupa Ridge", "Offshore Deepwater Dahomey"],
    tectonic_summary: "Rifted passive margin separated from the Niger Delta by the Okitipupa Ridge and Chain Fracture Zone.",
    stratigraphic_overview:
      "Abeokuta Group (Ise, Afowo, Araromi Formations), Ewekoro, Akinbo, Oshosun, and Ilaro Formations.",
    known_uncertainties_and_gaps:
      "Biodegradation in shallow onshore tar-sand reservoirs and offshore source-rock thermal maturity.",
  },
  {
    basin_name: "Sokoto Basin (Iullemmeden Basin)",
    basin_category: "Mesozoic–Cenozoic Intracratonic Syneclise",
    sub_basins_or_provinces: ["Gundumi-Illo Trough", "Rima-Sokoto Plain"],
    tectonic_summary: "Southeastern sector of the intracratonic Iullemmeden Basin with gentle northwesterly regional dip.",
    stratigraphic_overview:
      "Gundumi/Illo Formations, Rima Group (Taloka, Dukamaje, Wurno), Sokoto Group (Dange, Kalambaina), and Gwandu Formation.",
    known_uncertainties_and_gaps:
      "Shallow sedimentary thickness and low thermal maturity gradients across most of the Nigerian sector.",
  },
  {
    basin_name: "Chad Basin (Bornu Basin)",
    basin_category: "Mesozoic–Cenozoic Intracontinental Rift & Sag Basin",
    sub_basins_or_provinces: ["Maiduguri Sub-basin", "Gubio Trough", "Lake Chad Axis"],
    tectonic_summary: "Cretaceous NE–SW rift grabens overlain by Cenozoic regional sag deposits.",
    stratigraphic_overview:
      "Bima Sandstone, Gongila Formation, Fika Shale, Gombe Sandstone, Kerri-Kerri, and Chad Formation.",
    known_uncertainties_and_gaps: "Tertiary intrusive sill thermal effects and seal breach risk in faulted Fika/Gongila traps.",
  },
  {
    basin_name: "Calabar Flank",
    basin_category: "Cretaceous Passive-Margin Hinge Zone",
    sub_basins_or_provinces: ["Oban Massif Margin", "Ikang Trough", "Ituk High"],
    tectonic_summary: "NW–SE trending horst-and-graben hinge zone bordering the Oban Massif and Ikang Trough.",
    stratigraphic_overview: "Awi Formation, Mfamosing Limestone, Ekenkpon Shale, New Netim Marl, and Nkporo Shale.",
    known_uncertainties_and_gaps:
      "Rapid lateral carbonate-clastic facies transitions and limited burial depth on structural highs.",
  },
  {
    basin_name: "Nigerian Frontier & Borderland Areas",
    basin_category: "Under-Explored / Frontier Sedimentary Provinces",
    sub_basins_or_provinces: ["Mamfe Embayment (Nigerian Sector)", "Cross River Frontier"],
    tectonic_summary:
      "Narrow fault-bounded rift embayments adjoining the Cameroon Volcanic Line and basement massifs.",
    stratigraphic_overview: "Fluvio-lacustrine Cretaceous sandstones and organic-rich shales.",
    known_uncertainties_and_gaps:
      "Severe scarcity of calibrated seismic, well logs, and regional biostratigraphic controls.",
  },
];

let seedPromise: Promise<void> | null = null;

export async function ensureKnowledgeSeeded(): Promise<void> {
  if (seedPromise) return seedPromise;
  seedPromise = (async () => {
    try {
      const existingLicences = await db
        .select({ id: sourceLicences.id })
        .from(sourceLicences)
        .where(eq(sourceLicences.licenceCode, "OPEN_PEER_REVIEWED_METADATA"));

      if (existingLicences.length === 0) {
        await db
          .insert(sourceLicences)
          .values({
            id: crypto.randomUUID(),
            licenceCode: "OPEN_PEER_REVIEWED_METADATA",
            name: "Open Bibliographic Metadata & Short Scientific Citation Licence",
            permitsFullTextStorage: false,
            permitsSnippetRetrieval: true,
            attributionRequirements: "Cite author, title, year, journal/institution, and DOI.",
          })
          .onConflictDoNothing();
      }

      const existingBasins = await db.select().from(basinProfiles);
      if (existingBasins.length > 0) return;

      for (const entry of NIGERIAN_BASINS_TAXONOMY) {
        const basinId = crypto.randomUUID();
        await db.insert(basinProfiles).values({
          id: basinId,
          country: "Nigeria",
          basinName: entry.basin_name,
          basinCategory: entry.basin_category,
          subBasinsOrProvinces: entry.sub_basins_or_provinces,
          tectonicSummary: entry.tectonic_summary,
          stratigraphicOverview: entry.stratigraphic_overview,
          knownUncertaintiesAndGaps: entry.known_uncertainties_and_gaps,
          reviewStatus: ReviewStatus.APPROVED,
          deletedAt: null,
        });

        if (entry.basin_name === "Niger Delta Basin") {
          await db.insert(formationRecords).values([
            {
              id: crypto.randomUUID(),
              basinProfileId: basinId,
              formationName: "Benin Formation",
              recognizedAliases: ["Benin Sandstone"],
              stratigraphicRankOrder: 1,
              ageRange: "Oligocene-Recent",
              dominantLithology: "Continental massive fluvial sandstones",
              petroleumSystemRole: "Overburden / regional freshwater aquifer",
              reviewStatus: ReviewStatus.APPROVED,
              deletedAt: null,
            },
            {
              id: crypto.randomUUID(),
              basinProfileId: basinId,
              formationName: "Agbada Formation",
              recognizedAliases: ["Paralic Agbada"],
              stratigraphicRankOrder: 2,
              ageRange: "Eocene-Pliocene",
              dominantLithology: "Alternating deltaic sandstones and marine shales",
              petroleumSystemRole: "Primary reservoir and intraformational top/fault seal",
              reviewStatus: ReviewStatus.APPROVED,
              deletedAt: null,
            },
            {
              id: crypto.randomUUID(),
              basinProfileId: basinId,
              formationName: "Akata Formation",
              recognizedAliases: ["Akata Shale"],
              stratigraphicRankOrder: 3,
              ageRange: "Paleocene-Recent",
              dominantLithology: "Overpressured marine prodelta shales",
              petroleumSystemRole: "Primary regional source rock and detachment horizon",
              reviewStatus: ReviewStatus.APPROVED,
              deletedAt: null,
            },
          ]);
        }
      }
    } catch (error) {
      seedPromise = null;
      console.error("Database knowledge seed failed:", error);
      throw new Error("Database query failed. Please try again later.", { cause: error });
    }
  })();
  return seedPromise;
}
