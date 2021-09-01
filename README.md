## install reuiqred library

```
yarn add googleapis 
```

## .env
```
ANALYTICS_API_CREDENTIAL="{ANALYTICS APIのアクセス権限を持ったサービスアカウントの認証情報（JSON）をstringifyしたもの}"
ANALYTICS_API_VIEW_ID="{アナリティクスのView ID}"
```

### .env 注意点

JSON オブジェクトを.env に持ちたいときは、JSON.stringify をかけた文字列を持つ  
その際、`"{\"key\":\"value\", ....}"` の文字列（両端のダブルクオーテーションを含む）を持ちたいので、.env は

```
JSON=""{\"key\":\"value\", ....}""
```

というふうにダブルクオーテーションが二重になることに注意する
