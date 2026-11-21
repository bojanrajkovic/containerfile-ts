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
  validateShellCommand,
  validateOptional,
  LINE_BREAK,
} from "./primitives.js";
