// React Fast Refresh 시 Babel이 TS/JSX를 파싱할 수 있도록 설정
module.exports = {
  presets: [
    ["@babel/preset-react", { runtime: "automatic" }],
    "@babel/preset-typescript",
  ],
};
