console.log('before import')

async function run() {
  const mod = await import('./src/lib/mongo.server.ts')
  console.log('after import')
  const t = Date.now()
  const a = await mod.getAllArticlesFromMongo()
  console.log('done', a.length, Date.now() - t)
}

run().catch((err) => {
  console.error('script error', err)
  process.exit(1)
})
