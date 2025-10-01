import { createServer } from "http";
import { createYoga, createSchema } from "graphql-yoga";
import { GraphQLError } from "graphql";

// ---------- Schema ----------
const typeDefs = /* GraphQL */ `
  type Image {
    id: ID!
    url: String!
    elementId: ID!
  }
  type Element {
    id: ID!
    description: String
    assessmentText: String
    assessment: String
    images: [Image!]!
  }
  type Section {
    id: ID!
    title: String!
    elements: [Element!]!
  }
  type Form {
    id: ID!
    title: String!
    sections: [Section!]!
  }

  type MutationResult {
    ok: Boolean!
    id: ID
    message: String
  }
  type Query {
    form: Form!
  }

  input UpsertTextInput {
    elementId: ID!
    field: String!
    value: String!
  }
  input SetAssessmentInput {
    elementId: ID!
    value: String!
  }
  input UploadImageInput {
    elementId: ID!
    url: String!
  }
  input DeleteImageInput {
    id: ID!
  }
  input SubmitFormInput {
    formId: ID!
  }
  input DeleteFormInput {
    formId: ID!
  }

  type Mutation {
    upsertText(input: UpsertTextInput!): MutationResult!
    setAssessment(input: SetAssessmentInput!): MutationResult!
    uploadImage(input: UploadImageInput!): MutationResult!
    deleteImage(input: DeleteImageInput!): MutationResult!
    submitForm(input: SubmitFormInput!): MutationResult!
    deleteForm(input: DeleteFormInput!): MutationResult!
  }
`;

// ---------- In-memory store with element state ----------
type ElementState = {
  id: string;
  description: string;
  assessmentText: string;
  assessment: string | null;
};

const ELEMENT_IDS = ["E1-1", "E1-2", "E2-1", "E2-2"];

const DB = {
  form: {
    id: "F1",
    title: "Evaluation form",
    sections: [
      {
        id: "S1",
        title: "Section 1: Basic Information",
        elements: [{ id: "E1-1" }, { id: "E1-2" }],
      },
      {
        id: "S2",
        title: "Section 2: Detailed Assessment",
        elements: [{ id: "E2-1" }, { id: "E2-2" }],
      },
    ],
  },
  // state per element:
  elements: new Map<string, ElementState>(
    ELEMENT_IDS.map((id) => [
      id,
      { id, description: "", assessmentText: "", assessment: null },
    ])
  ),
  images: [] as Array<{ id: string; url: string; elementId: string }>,
};

// ---------- Helpers ----------
function requireAuth(request: Request) {
  const auth = request.headers.get("authorization") || "";
  if (!auth.endsWith(" demo")) {
    throw new GraphQLError("Unauthorized", {
      extensions: { code: "UNAUTHENTICATED", http: { status: 401 } },
    });
  }
}
function maybeHiccup() {
  if (Math.random() < 0.1) {
    throw new GraphQLError("Random server hiccup", {
      extensions: { code: "INTERNAL_SERVER_ERROR", http: { status: 500 } },
    });
  }
}
function getElementState(elementId: string): ElementState {
  const st = DB.elements.get(elementId);
  if (!st) {
    const fresh = {
      id: elementId,
      description: "",
      assessmentText: "",
      assessment: null as string | null,
    };
    DB.elements.set(elementId, fresh);
    return fresh;
  }
  return st;
}

// ---------- Resolvers ----------
const resolvers = {
  Query: {
    form: () => ({
      ...DB.form,
      sections: DB.form.sections.map((s) => ({
        ...s,
        elements: s.elements.map((e) => {
          const st = getElementState(e.id);
          return {
            id: e.id,
            description: st.description,
            assessmentText: st.assessmentText,
            assessment: st.assessment,
            images: DB.images.filter((img) => img.elementId === e.id),
          };
        }),
      })),
    }),
  },

  Mutation: {
    upsertText: (_: any, { input }: any, ctx: any) => {
      requireAuth(ctx.request);
      maybeHiccup();
      const { elementId, field, value } = input as {
        elementId: string;
        field: string;
        value: string;
      };
      const st = getElementState(elementId);
      if (field !== "description" && field !== "assessmentText") {
        throw new GraphQLError("Invalid field", {
          extensions: { code: "BAD_USER_INPUT", http: { status: 400 } },
        });
      }
      (st as any)[field] = value;
      return { ok: true };
    },

    setAssessment: (_: any, { input }: any, ctx: any) => {
      requireAuth(ctx.request);
      maybeHiccup();
      const { elementId, value } = input as {
        elementId: string;
        value: string | null;
      };
      const st = getElementState(elementId);
      st.assessment = value;
      return { ok: true };
    },

    uploadImage: (_: any, { input }: any, ctx: any) => {
      requireAuth(ctx.request);
      maybeHiccup();
      const id = "IMG_" + Math.random().toString(36).slice(2, 9);
      DB.images.push({ id, url: input.url, elementId: input.elementId });
      return { ok: true, id };
    },

    deleteImage: (_: any, { input }: any, ctx: any) => {
      requireAuth(ctx.request);
      maybeHiccup();
      const idx = DB.images.findIndex((i) => i.id === input.id);
      if (idx >= 0) DB.images.splice(idx, 1);
      return { ok: true, id: input.id };
    },

    submitForm: (_: any, _args: any, ctx: any) => {
      requireAuth(ctx.request);
      maybeHiccup();
      return { ok: true };
    },

    deleteForm: (_: any, { input }: any, ctx: any) => {
      requireAuth(ctx.request);
      maybeHiccup();
      // Reset all element state and images
      for (const id of ELEMENT_IDS)
        DB.elements.set(id, {
          id,
          description: "",
          assessmentText: "",
          assessment: null,
        });
      DB.images = [];
      return { ok: true };
    },
  },
};

// ---------- Yoga ----------
const corsOrigins = (process.env.CORS_ORIGIN || "*")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const schema = createSchema({ typeDefs, resolvers });

const yoga = createYoga({
  schema,
  cors: {
    origin: corsOrigins.length === 1 ? corsOrigins[0] : corsOrigins,
    credentials: true,
  },
  fetchAPI: { fetch, Request, Response, Headers },
});

const server = createServer(yoga);
server.listen(process.env.PORT || 4000, () => {
  console.log("GraphQL listening on :4000");
});
