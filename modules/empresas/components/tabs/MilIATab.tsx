import { Company } from "../../types";
import IntelligentDiagnosis from "../ia/IntelligentDiagnosis";

interface Props {
  company: Company;
}

export default function MilIATab({ company }: Props) {
  return (
    <IntelligentDiagnosis company={company} />
  );
}