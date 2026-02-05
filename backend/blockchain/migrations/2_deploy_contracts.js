const AcademicCredentialRegistry = artifacts.require("AcademicCredentialRegistry");

module.exports = function (deployer) {
  deployer.deploy(AcademicCredentialRegistry);
};
