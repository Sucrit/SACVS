const AcademicCredentialRegistry = artifacts.require("AcademicCredentialRegistry");

export default function (deployer) {
  deployer.deploy(AcademicCredentialRegistry);
};
