// Creative Knowledge Library — Industries Registry

import type { IndustryKnowledge } from "../types";

import { foodHospitality }    from "./food-hospitality";
import { healthcareDental }   from "./healthcare-dental";
import { realEstate }         from "./real-estate";
import { jewelryLuxury }      from "./jewelry-luxury";
import { financialServices }  from "./financial-services";
import { fitnessWellness }    from "./fitness-wellness";
import { automotive }         from "./automotive";
import { education }          from "./education";
import { beautySalon }        from "./beauty-salon";
import { retailFashion }      from "./retail-fashion";
import { eventsEntertainment } from "./events-entertainment";
import { techSoftware }       from "./tech-software";
import { general }            from "./general";

export const KNOWLEDGE_REGISTRY: Record<string, IndustryKnowledge> = {
  [foodHospitality.id]:     foodHospitality,
  [healthcareDental.id]:    healthcareDental,
  [realEstate.id]:          realEstate,
  [jewelryLuxury.id]:       jewelryLuxury,
  [financialServices.id]:   financialServices,
  [fitnessWellness.id]:     fitnessWellness,
  [automotive.id]:          automotive,
  [education.id]:           education,
  [beautySalon.id]:         beautySalon,
  [retailFashion.id]:       retailFashion,
  [eventsEntertainment.id]: eventsEntertainment,
  [techSoftware.id]:        techSoftware,
  [general.id]:             general,
};

export {
  foodHospitality,
  healthcareDental,
  realEstate,
  jewelryLuxury,
  financialServices,
  fitnessWellness,
  automotive,
  education,
  beautySalon,
  retailFashion,
  eventsEntertainment,
  techSoftware,
  general,
};
