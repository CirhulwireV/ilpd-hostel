# Room image storage on Amazon S3

The API receives an authenticated admin upload at `POST /api/rooms/images`, writes
the files to S3 under `room-images/`, and stores only the resulting URL in MongoDB.
The browser never receives AWS credentials, so no bucket CORS rule is required.

## 1. Add environment variables

Copy these values into `backend/.env` (do not commit that file):

```env
AWS_S3_BUCKET=your-bucket-name
AWS_REGION=af-south-1
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
CLOUDFRONT_URL=https://your-distribution.cloudfront.net
```

`CLOUDFRONT_URL` is recommended. If it is left blank, the application stores the
standard S3 object URL instead; those objects must then be publicly readable.

## 2. Grant the backend's IAM identity minimum access

Replace `your-bucket-name` in this policy and attach it to the IAM user or role
used by the backend:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["s3:PutObject"],
    "Resource": "arn:aws:s3:::your-bucket-name/room-images/*"
  }]
}
```

## 3. Make uploaded objects readable

For production, keep the bucket private and configure a CloudFront distribution
with Origin Access Control. Set its distribution URL as `CLOUDFRONT_URL`.

For a short-term S3-only setup, allow public `s3:GetObject` access to
`room-images/*` in the bucket policy. Do not use a public write policy.

## 4. Install dependencies and deploy

Run this from `backend` after pulling the code:

```bash
npm install
```

The endpoint accepts up to five JPG, PNG, or WebP files, each at most 3 MB.
Existing Base64 images remain readable; newly uploaded images are URLs.
