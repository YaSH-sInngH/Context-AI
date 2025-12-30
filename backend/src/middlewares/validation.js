import {body} from 'express-validator';

export const validateUser = [
    body("email").isEmail(),
    body("password").isLength({min: 6}),
]