const byrnes = require("..");

byrnes.init({
  rootDir: "",
  allow: [
    {
      module: [
        "node_modules/jest-message-util/",
        "node_modules/jest-runtime/",
        "node_modules/jest-jasmine2/",
        "node_modules/@jest/",
        "node_modules/jest-runner/",
        "node_modules/jest-cli/",
        "node_modules/source-map-support/",
        "node_modules/expect/",
        'node_modules/jsdom/'
      ],
      privileges: ["fs"],
    },
    {
        module: [
          "node_modules/source-map-support/"
        ],
        privileges: ["fs"],
        alwaysAllow: true
      }
  ],
  logOnly: true,
});

test("It disallows multiple inititalisations", () => {
  expect(() => {
    byrnes.init({ rootDir: "" });
  }).toThrow();
});
