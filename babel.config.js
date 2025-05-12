module.exports = function (api) {
    api.cache(true);
    return {
      presets: [
        ["babel-preset-expo", { jsxImportSource: "nativewind" }],
        "nativewind/babel",
       
    // // Comment this plugin for web build:
    // plugins: [
    //   // 'react-native-reanimated/plugin', // only needed for native builds
    // ],
  ]
    };
  };