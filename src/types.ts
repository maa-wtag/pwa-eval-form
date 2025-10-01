export type ElementId = string;

export type Assessment = "PASS" | "NEUTRAL" | "FAIL" | null;

export interface ImageItem {
  id: string;
  url: string;
  elementId: ElementId;
}

export interface ElementModel {
  id: ElementId;
  description: string;
  assessmentText: string;
  assessment: Assessment;
  images: ImageItem[];
}

export interface SectionModel {
  id: string;
  title: string;
  elements: ElementModel[];
}

export interface FormModel {
  id: string;
  title: string;
  sections: SectionModel[];
}
