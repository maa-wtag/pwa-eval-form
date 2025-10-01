import React from "react";
import type { ElementModel } from "../types";
import { ButtonGroup } from "./ButtonGroup";
import { TextareaDebouncedBlur } from "./TextareaDebouncedBlur";
import { ImageUploader } from "./ImageUploader";
import { deleteImage, setAssessment, upsertText, uploadImage } from "../api";

export const ElementPanel: React.FC<{ element: ElementModel }> = ({
  element,
}) => {
  return (
    <div className="card right-panel">
      <div className="row" style={{ fontWeight: 800 }}>
        Element {element.id.replace("E", "").replace("-", ".")}
      </div>

      <div className="panel">
        <div className="small" style={{ marginBottom: 6 }}>
          Images ({element.images.length} / 4)
        </div>
        <ImageUploader
          items={element.images}
          canAdd={element.images.length < 4}
          onUpload={(file) => uploadImage(element.id, file)}
          onDelete={(id) => deleteImage(id, element.id)}
        />
      </div>

      <div className="panel">
        <div className="small" style={{ marginBottom: 6 }}>
          Description
        </div>
        <TextareaDebouncedBlur
          key={element.id + "-description"}
          defaultValue={element.description}
          placeholder="Add a comment to the review"
          onCommit={(v) => upsertText(element.id, "description", v)}
        />
      </div>

      <div className="panel">
        <div className="small" style={{ marginBottom: 6 }}>
          The assessment
        </div>
        <TextareaDebouncedBlur
          key={element.id + "-assessmentText"}
          defaultValue={element.assessmentText}
          placeholder="Assess the current situation"
          onCommit={(v) => upsertText(element.id, "assessmentText", v)}
        />
      </div>

      <div className="panel">
        <div className="small" style={{ marginBottom: 6 }}>
          Assessment
        </div>
        <ButtonGroup
          value={element.assessment}
          onChange={(v) => setAssessment(element.id, v)}
        />
      </div>
    </div>
  );
};
