import type { ElementId, FormModel, Assessment } from "./types";
import { saveForm, loadForm, getToken } from "./db";

const bcForm = new BroadcastChannel("form-updates");
function notifyFormUpdated(form: FormModel) {
  bcForm.postMessage({ type: "FORM_UPDATED", form });
}

const gql = async (query: string, variables: any) => {
  // Always POST to /graphql (captured by SW)
  const token = (await getToken()) ?? "";
  const res = await fetch("/graphql", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  // We purposely do not throw for !res.ok — SW may convert 401/5xx to queued
  return res.json().catch(() => ({}));
};

// Read initial shape (GET okay offline via cache-first once fetched)
export async function fetchForm(): Promise<FormModel> {
  // Try online first, fall back to local DB
  try {
    const data = await gql(
      `query { form { id title sections { id title elements { id description assessmentText assessment images { id url elementId } } } } }`,
      {}
    );
    if (data?.data?.form) {
      await saveForm(data.data.form);
      return data.data.form;
    }
  } catch (_) {}
  const local = await loadForm();
  if (local) return local;
  // Minimal offline seed if first run completely offline
  return {
    id: "F1",
    title: "Evaluation form",
    sections: [
      {
        id: "S1",
        title: "Section 1: Basic Information",
        elements: [
          {
            id: "E1-1",
            description: "",
            assessmentText: "",
            assessment: null,
            images: [],
          },
          {
            id: "E1-2",
            description: "",
            assessmentText: "",
            assessment: null,
            images: [],
          },
        ],
      },
      {
        id: "S2",
        title: "Section 2: Detailed Assessment",
        elements: [
          {
            id: "E2-1",
            description: "",
            assessmentText: "",
            assessment: null,
            images: [],
          },
          {
            id: "E2-2",
            description: "",
            assessmentText: "",
            assessment: null,
            images: [],
          },
        ],
      },
    ],
  };
}

// All below “fire & forget”: update local DB first (optimistic), then call API.
// SW will queue failed POSTs (offline or 401/5xx) and retry later.

export async function upsertText(
  elementId: ElementId,
  field: "description" | "assessmentText",
  value: string
) {
  const form = await loadForm();
  if (form) {
    for (const s of form.sections) {
      const el = s.elements.find((e) => e.id === elementId);
      if (el) (el as any)[field] = value;
    }
    await saveForm(form);
    notifyFormUpdated(form);
  }
  void gql(
    `mutation($input: UpsertTextInput!) { upsertText(input: $input) { ok } }`,
    { input: { elementId, field, value } }
  );
}

export async function setAssessment(elementId: ElementId, value: Assessment) {
  const form = await loadForm();
  if (form) {
    for (const s of form.sections) {
      const el = s.elements.find((e) => e.id === elementId);
      if (el) el.assessment = value;
    }
    await saveForm(form);
    notifyFormUpdated(form);
  }
  void gql(
    `mutation($input: SetAssessmentInput!) { setAssessment(input: $input) { ok } }`,
    { input: { elementId, value } }
  );
}

export async function uploadImage(elementId: ElementId, file: File) {
  // 1) Create a local preview immediately
  const previewUrl = URL.createObjectURL(file);

  // 2) Optimistically add with a temporary id
  const tmpId = "tmp_" + Math.random().toString(36).slice(2, 9);
  const form = await loadForm();
  if (form) {
    for (const s of form.sections) {
      const el = s.elements.find((e) => e.id === elementId);
      if (el && el.images.length < 4) {
        el.images.push({ id: tmpId, url: previewUrl, elementId });
      }
    }
    await saveForm(form);
    notifyFormUpdated(form);
  }

  // 3) Fire-and-forget the "upload" — still goes via SW + background-sync if offline
  try {
    const body = new FormData();
    body.append("file", file);
    await fetch("/httpbin/post", { method: "POST", body });
  } catch (_) {
    // ignored; SW will queue if offline
  }

  // 4) Inform GraphQL that an image exists (using our preview URL as placeholder)
  //    (In a real app, you'd pass back a CDN URL from your media server.)
  void gql(
    `mutation($input: UploadImageInput!) { uploadImage(input: $input) { ok id } }`,
    { input: { elementId, url: previewUrl } }
  );
}

export async function deleteImage(imageId: string, elementId: ElementId) {
  const form = await loadForm();
  if (form) {
    for (const s of form.sections) {
      const el = s.elements.find((e) => e.id === elementId);
      if (el) el.images = el.images.filter((i) => i.id !== imageId);
    }
    await saveForm(form);
    notifyFormUpdated(form);
  }
  void gql(
    `mutation($input: DeleteImageInput!) { deleteImage(input: $input) { ok } }`,
    { input: { id: imageId } }
  );
}

export async function submitForm(formId: string) {
  void gql(
    `mutation($input: SubmitFormInput!) { submitForm(input: $input) { ok } }`,
    { input: { formId } }
  );
}

export async function deleteForm(formId: string) {
  const fresh: FormModel = {
    id: formId,
    title: "Evaluation form",
    sections: [
      {
        id: "S1",
        title: "Section 1: Basic Information",
        elements: [
          {
            id: "E1-1",
            description: "",
            assessmentText: "",
            assessment: null,
            images: [],
          },
          {
            id: "E1-2",
            description: "",
            assessmentText: "",
            assessment: null,
            images: [],
          },
        ],
      },
      {
        id: "S2",
        title: "Section 2: Detailed Assessment",
        elements: [
          {
            id: "E2-1",
            description: "",
            assessmentText: "",
            assessment: null,
            images: [],
          },
          {
            id: "E2-2",
            description: "",
            assessmentText: "",
            assessment: null,
            images: [],
          },
        ],
      },
    ],
  };
  await saveForm(fresh);
  notifyFormUpdated(fresh); // <-- add this
  void gql(
    `mutation($input: DeleteFormInput!) { deleteForm(input: $input) { ok } }`,
    { input: { formId } }
  );
}
