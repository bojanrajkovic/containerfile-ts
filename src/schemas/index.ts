// pattern: Functional Core

export {
  // Branded types
  type Port,
  type ImageName,
  type DockerPath,
  type PortRange,
  // Schemas
  PortSchema,
  ImageNameSchema,
  DockerPathSchema,
  // Validation functions
  validatePort,
  validateImageName,
  validateDockerPath,
  validatePortRange,
  validateString,
  validateNonEmptyString,
  validateStringArray,
  validateOptional,
} from "./primitives.js";
