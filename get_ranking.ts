import { google } from 'googleapis'
import { CredentialBody } from 'google-auth-library/build/src/auth/credentials'
import { analyticsreporting_v4 } from 'googleapis'
import { GaxiosResponse } from 'googleapis-common'

//Google Analytics APIからランキングデータ作成

type AnalyticsreportingArgs = Parameters<typeof google.analyticsreporting>
type AnalyticsreportingAuthClient = AnalyticsreportingArgs[0]['auth']

type SuccessResponse = {
  path: string
  views: number
}[]

interface ErrorResponse {
  error: string
}

type Params = {
  includes_paths?: string //集計対象のパスに含める、文字列orRegex配列のカンマ区切り
}

const getAnalyticsRankingData: NextApiHandlerWithParams<
  Params,
  SuccessResponse | ErrorResponse
> = async (req, res) => {
  console.log(req.query)

  //同名パラメータは最初のもののみを参照する
  Object.keys(req.query).forEach((key: keyof Params) => {
    req.query[key] = Array.isArray(req.query[key])
      ? req.query[key][0]
      : req.query[key]
  })

  /**
   * 認証情報（.env上にJSONをstringifyして保存）を取得してパースし、JSONオブジェクトで返す
   * @returns credential JSON Object
   */
  const getCredentials = (): CredentialBody => {
    let credentials
    try {
      //改行処理
      const credentialsString = process.env.ANALYTICS_API_CREDENTIAL.replace(
        /\n/g,
        '\\n',
      )

      credentials = JSON.parse(JSON.parse(credentialsString)) as CredentialBody
    } catch (e) {
      console.log('invalid credential file', e)
      res.status(500).json({ error: 'internal error' })
    }

    return credentials
  }

  /**
   * 認証用クライアント作成
   * @param credentials 認証情報（JSON）オブジェクト
   * @returns 認証クライアント
   */
  const getClient = async (
    credentials: CredentialBody,
  ): Promise<AnalyticsreportingAuthClient> => {
    let client
    try {
      client = await google.auth.getClient({
        scopes: 'https://www.googleapis.com/auth/analytics.readonly',
        credentials,
      })
    } catch (e) {
      console.log('authentication failed', e)
      res.status(500).json({ error: 'internal error' })
    }

    return client
  }

  /**
   * レポートデータの取得
   * @param client 認証用クライアント
   * @returns レポートデータオブジェクト
   */
  const getReport = async (
    client: AnalyticsreportingAuthClient,
  ): Promise<
    GaxiosResponse<analyticsreporting_v4.Schema$GetReportsResponse>
  > => {
    //reportingクライアントを認証
    let analyticsreporting
    try {
      analyticsreporting = google.analyticsreporting({
        version: 'v4',
        auth: client,
      })
    } catch (e) {
      console.log('fail at getting reporting client', e)
      res.status(500).json({ error: 'internal error' })
    }

    //対象パス指定が正しい文字列 or regexかチェック
    let { includes_paths = '' } = req.query
    let includesPathsArray

    try {
      //カンマ区切りの文字列 or regexを配列へ変換
      includesPathsArray = includes_paths.split(',').map((path) => {
        const decodedPath = decodeURIComponent(path)
        new RegExp(decodedPath)

        return decodedPath
      })
    } catch (e) {
      console.log('includes_path is not valid', e)
      res.status(500).json({ error: 'internal error' })
    }

    //レポート取得
    try {
      const report = await analyticsreporting.reports.batchGet({
        requestBody: {
          reportRequests: [
            {
              viewId: process.env.ANALYTICS_API_VIEW_ID,
              dateRanges: [
                {
                  startDate: '30daysAgo',
                  endDate: '1daysAgo',
                },
              ],
              dimensions: [
                {
                  name: 'ga:pagePath',
                },
              ],
              dimensionFilterClauses: [
                {
                  operator: 'OR',
                  filters: includesPathsArray.map((path) => ({
                    dimensionName: 'ga:pagePath',
                    operator: 'REGEXP',
                    expressions: [path],
                  })),
                },
              ],
              metrics: [
                // 利用する指標
                {
                  expression: 'ga:pageviews',
                },
              ],
              orderBys: [
                {
                  //ソート順
                  fieldName: 'ga:pageviews',
                  sortOrder: 'DESCENDING',
                },
              ],
              pageSize: 10,
            },
          ],
        },
      })

      return report
    } catch (e) {
      console.log('fail at getting report', e)
      res.status(500).json({ error: 'internal error' })
    }
  }

  /**
   * 取得したレポートデータオブジェクトを path と viewsのみのオブジェクト配列にして返す
   * @param report レポートデータオブジェクト
   * @returns path と viewsのみのオブジェクト配列
   */
  const formatReport = (
    report: GaxiosResponse<analyticsreporting_v4.Schema$GetReportsResponse>,
  ) => {
    try {
      const reportData = report.data.reports[0].data
      const pathViewsArray = reportData.rows
        ? reportData.rows.map((row) => {
            const path = row.dimensions[0]
            const views = parseInt(row.metrics[0].values[0])

            return { path, views }
          })
        : []

      if (pathViewsArray.length === 0)
        console.log('[info] got report successfully, but no data')

      return pathViewsArray
    } catch (e) {
      console.log('fail at formatting report data', e)
      res.status(500).json({ error: 'internal error' })
    }
  }

  const credentials = getCredentials()
  const client = await getClient(credentials)
  const report = await getReport(client)
  const formattedReport = formatReport(report)

  //ページパスとビュー数のみの表示
  res.status(200).json(formattedReport)

  //debug:レポート全体の表示
  //   res.status(200).json(report)
}

export default getAnalyticsRankingData
