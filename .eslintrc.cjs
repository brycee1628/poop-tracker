module.exports = {
    env: {
        browser: true,
        es2021: true,
        node: true,
    },
    extends: ["react-app"],
    parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: {
            jsx: true,
        },
    },
    plugins: ["prettier", "react-hooks"],
    rules: {
        "prettier/prettier": "warn",
        "react-hooks/rules-of-hooks": "error",
        "react-hooks/exhaustive-deps": "warn",
    },
};