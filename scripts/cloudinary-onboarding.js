const cloudinary = require('cloudinary').v2

cloudinary.config({
  cloud_name: 'g9mozzeb',
  api_key: '653478863599471',
  api_secret: '1ublJ4Zp50YnyTNqkE-SGHhSnow',
})

const SAMPLE_IMAGE = 'https://res.cloudinary.com/demo/image/upload/sample.jpg'

async function main() {
  console.log('Uploading sample image...')
  const upload = await cloudinary.uploader.upload(SAMPLE_IMAGE, { folder: 'schoolpilot-onboarding' })
  console.log('Secure URL:', upload.secure_url)
  console.log('Public ID:', upload.public_id)

  console.log('\nFetching image details...')
  const details = await cloudinary.api.resource(upload.public_id)
  console.log('Width:', details.width)
  console.log('Height:', details.height)
  console.log('Format:', details.format)
  console.log('Bytes:', details.bytes)

  // f_auto: serve best format for the browser (e.g. WebP/AVIF when supported)
  // q_auto: automatic quality tuning for smaller file size without visible loss
  const transformedUrl = cloudinary.url(upload.public_id, {
    fetch_format: 'auto',
    quality: 'auto',
    secure: true,
  })

  console.log('\nDone! Click link below to see optimized version of the image. Check the size and the format.')
  console.log('Transformed URL:', transformedUrl)
}

main().catch((err) => {
  console.error('Cloudinary onboarding failed:', err.message)
  process.exit(1)
})
